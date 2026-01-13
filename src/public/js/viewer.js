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
        this.initSounds(); // Initialize audio alerts
        this.socket.emit('join-room', this.roomId, 'viewer');

        // Track pending commands
        this.pendingCommands = new Map();
        this.connectionStatus = 'connecting';
        this.monitorConnected = false;

        // Start heartbeat
        this.startHeartbeat();

        // Update connection indicator
        this.updateConnectionUI();

        // Populate UI
        const sessionDisplay = document.getElementById('session-name-display');
        if (sessionDisplay) sessionDisplay.innerText = this.roomId;

        const startTimeDisplay = document.getElementById('session-start-time');
        if (startTimeDisplay) startTimeDisplay.innerText = new Date().toLocaleTimeString('ar-EG');

        // QR & Link Logic
        this.generateMonitorLink();
    }


    initSounds() {
        // Simple generated beep sounds (Base64)
        this.sounds = {
            // High pitch short beep (Success/Connect)
            connect: new Audio('data:audio/wav;base64,UklGRl9vT1BXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' + Array(20).join('f39/')),

            // Low pitch beep (Disconnect/Error)
            disconnect: new Audio('data:audio/wav;base64,UklGRl9vT1BXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' + Array(20).join('000/'))
        };

        // Actually, let's use a cleaner approach with AudioContext for better generated sounds if possible,
        // but for now, base64 blobs are safer for strict CSPs. 
        // Let's use real short base64 strings for "check" and "error" sounds.

        // Success Chime
        this.sounds.connect = new Audio('data:audio/mp3;base64,SUQzBAAAAAABAFRYWFgAAAASAAADbWFqb3JfYnJhbmQAbXA0MgBUWFhYAAAAEQAAA21pbm9yX3ZlcnNpb24AMABUWFhYAAAAHAAAA2NvbXBhdGlibGVfYnJhbmRzAGlzb21tcDQyAFRTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAJAAABSAAZGRkZGRkZGRkZMTExMTExMTExMTFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFAAAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAASw8S+QAAAAAAAAAAAAAAAAAAAAA//uQZAAABi0vV0wwQAAm5erpgggAAIxS9XTDDAACbl6umCGAAJgAAAAUAAAAEAAAAA0gAAABHAAABuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwf/7kGQAAAZAL1dMMMAAJwXq6YIYAAhRL1lMMMAAJUS9ZTDBgACYAAAAJAAAABAAAAANIAAABHAAABuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFuwW7BbsFu');

        // Error/Disconnect Beep (Generated using oscillator logic or fallback to empty for now if not available)
        // Since I can't easily upload binary files, I'll use the browser's AudioContext for dynamic beeps!
        // This is much better and cleaner than embedding giant base64 strings.

        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    playSound(type) {
        if (!this.audioCtx) return;

        // Resume context if suspended (browser autoplay policy)
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        if (type === 'connect') {
            // Success sound: Rising tone
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, this.audioCtx.currentTime); // A4
            osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.1); // A5
            gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.3);
        } else if (type === 'disconnect') {
            // Error sound: Falling distinctive tone
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, this.audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, this.audioCtx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.3);
        } else if (type === 'alert') {
            // Alert sound: Two aggressive beeps
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.1);

            setTimeout(() => {
                const osc2 = this.audioCtx.createOscillator();
                const gain2 = this.audioCtx.createGain();
                osc2.type = 'sawtooth';
                osc2.frequency.setValueAtTime(800, this.audioCtx.currentTime);
                gain2.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
                osc2.connect(gain2);
                gain2.connect(this.audioCtx.destination);
                osc2.start();
                osc2.stop(this.audioCtx.currentTime + 0.1);
            }, 200);
        }
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
        // Monitor ready events
        this.socket.on('monitor-ready', () => {
            console.log('✅ Monitor is ready');
            this.monitorConnected = true;
            this.updateConnectionUI('connected');
            this.startWebRTC();
            this.hideSetup();
        });

        this.socket.on('user-connected', (data) => {
            const role = data.role || data; // Support both formats
            console.log(`User connected: ${role}`);

            if (role === 'monitor') {
                this.monitorConnected = true;
                this.updateConnectionUI('connected');
                this.startWebRTC();
                this.hideSetup();
                Core.showNotification('✅ تم الاتصال بالجهاز المراقب', 'success');
            }
        });

        this.socket.on('user-disconnected', (data) => {
            if (data.role === 'monitor') {
                this.monitorConnected = false;
                this.updateConnectionUI('disconnected');
                Core.showNotification('⚠️ انقطع الاتصال بالجهاز المراقب', 'warning');
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

        // Command sent confirmation
        this.socket.on('command-sent', (data) => {
            console.log(`📤 Command sent to monitor: ${data.command}`);
        });

        // Command acknowledgment
        this.socket.on('command-ack', (data) => {
            console.log(`✅ Command ACK received [${data.commandId}]:`, data.status);

            // Remove from pending
            this.pendingCommands.delete(data.commandId);

            if (data.status === 'success') {
                Core.showNotification(`✓ تم تنفيذ الأمر بنجاح: ${data.command}`, 'success');
            } else {
                Core.showNotification(`✗ فشل تنفيذ الأمر: ${data.error || 'خطأ غير معروف'}`, 'error');
            }
        });

        this.socket.on('status-update', (data) => {
            console.log("Status update received:", data);

            // Auto-detect presence if missed join event
            if (!this.monitorConnected) {
                this.monitorConnected = true;
                this.updateConnectionUI('connected');
            }

            if (data.type === 'photo-captured') {
                this.addFileToExplorer(data.data, data.timestamp);
                Core.showNotification("تم التقاط صورة وحفظها في الملفات", "success");
            } else if (data.type === 'sms-sent') {
                Core.showNotification(`تم فتح تطبيق الرسائل للرقم: ${data.phone}`, "success");
            } else if (data.type === 'sms-sent-server') {
                Core.showNotification(`✓ تم إرسال الرسالة بنجاح إلى: ${data.phone}`, "success");
            } else if (data.battery) {
                this.updateBatteryUI(data.battery);
                if (data.battery <= 10 && !data.charging) {
                    Core.showNotification("⚠️ تنبيه: بطارية الجهاز المراقب منخفضة جداً (أقل من 10%)", "error");
                    this.playSound('alert');
                } else {
                    Core.showNotification("تم تحديث حالة الجهاز بنجاح");
                }
            }
        });

        // Motion Detection Alert
        this.socket.on('motion-detected', (data) => {
            console.warn("Motion detected!", data);
            Core.showNotification("🚨 تنبيه: تم رصد حركة أمام الكاميرا الآن!", "warning");
            this.playSound('alert');

            // Visual feedback on video
            const video = document.getElementById('remoteVideo');
            if (video) {
                video.style.outline = "5px solid #ef4444";
                video.style.outlineOffset = "-5px";
                setTimeout(() => video.style.outline = "none", 3000);
            }
        });

        this.socket.on('device-info', (payload) => this.updateDeviceInfoUI(payload.info));

        this.socket.on('stream-data', (payload) => {
            if (payload.image && payload.isSnapshot) this.addToGallery(payload.image);
        });

        // Room status
        this.socket.on('room-status', (data) => {
            console.log(`Room status: ${data.clientCount} client(s)`);
            this.twilioEnabled = data.twilioEnabled;
            // Update UI if needed
            if (window.updateSmsStatus) window.updateSmsStatus(this.twilioEnabled);
        });

        // Connection events
        this.socket.on('disconnect', () => {
            console.log('⚠️ Disconnected from server');
            this.connectionStatus = 'disconnected';
            this.updateConnectionUI('disconnected');
        });

        this.socket.on('connect', () => {
            console.log('✅ Connected to server');
            this.connectionStatus = 'connected';
            this.updateConnectionUI('connected');
            this.socket.emit('join-room', this.roomId, 'viewer');
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
        // Multi-cam session storage
        this.saveActiveSession();
    }

    saveActiveSession() {
        const sessions = JSON.parse(localStorage.getItem('sw_active_sessions') || '[]');
        if (!sessions.includes(this.roomId)) {
            sessions.push(this.roomId);
            localStorage.setItem('sw_active_sessions', JSON.stringify(sessions));
        }
    }

    toggleSiren() {
        if (!this.monitorConnected) return alert("الجهاز غير متصل");
        this.isSirenActive = !this.isSirenActive;
        // The monitor system handles 'play-siren' as a generic command
        this.socket.emit('command', {
            roomId: this.roomId,
            command: 'play-siren',
            value: this.isSirenActive,
            commandId: `siren_${Date.now()}`,
            timestamp: Date.now()
        });

        const btn = document.getElementById('siren-btn');
        if (btn) {
            btn.classList.toggle('active', this.isSirenActive);
            btn.style.background = this.isSirenActive ? '#ef4444' : '';
            btn.style.color = this.isSirenActive ? 'white' : '';
        }
        Core.showNotification(this.isSirenActive ? "🚨 تم تشغيل الصرخة!" : "تم إيقاف الصرخة", "info");
    }

    sendCommand(command, value = null) {
        // Generate unique command ID
        const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // New commands use unified 'command' event
        const newCommands = ['take-photo', 'get-status', 'send-sms'];
        const eventType = newCommands.includes(command) ? 'command' : 'control-command';

        const payload = {
            roomId: this.roomId,
            command,
            value,
            commandId,
            timestamp: Date.now()
        };

        // Track pending command
        this.pendingCommands.set(commandId, {
            command,
            sentAt: Date.now(),
            timeout: setTimeout(() => {
                if (this.pendingCommands.has(commandId)) {
                    this.pendingCommands.delete(commandId);
                    Core.showNotification(`⚠️ انتهى وقت الأمر: ${command}`, 'warning');
                }
            }, 10000) // 10 second timeout
        });

        this.socket.emit(eventType, payload);

        const labels = {
            'switch-camera': 'تبديل الكاميرا',
            'toggle-torch': 'تغيير وضع الكشاف',
            'set-zoom': 'تغيير مستوى الزووم',
            'capture-photo': 'جاري التقاط صورة...',
            'take-photo': 'جاري التقاط صورة سرية...',
            'get-status': 'جاري سحب بيانات الجهاز...',
            'restart-app': 'جاري إعادة تشغيل الكاميرا...',
            'hard-lock': 'تفعيل وضع القفل الكامل',
            'screen-dim': 'تبديل وضع التخفي',
            'send-sms': 'جاري إرسال الرسالة...'
        };
        Core.showNotification(labels[command] || 'تم إرسال الأمر', 'info');
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
        const icon = document.getElementById('batt-icon');
        if (!lvl || !icon) return;

        // Handle both formats: number or object with .level
        const batteryLevel = typeof p === 'number' ? p : (p.level || p);
        lvl.innerText = batteryLevel + '%';

        // Update icon based on status
        if (p.charging) {
            icon.name = 'battery-charging-outline';
            icon.style.color = '#fbbf24';
            icon.classList.add('pulsing');
        } else {
            icon.classList.remove('pulsing');
            icon.style.color = batteryLevel > 20 ? 'var(--accent)' : 'var(--danger)';
            if (batteryLevel > 90) icon.name = 'battery-full-outline';
            else if (batteryLevel > 50) icon.name = 'battery-half-outline';
            else icon.name = 'battery-dead-outline';
        }
    }

    updateSignalUI(info) {
        const sigLevel = document.getElementById('signal-level');
        const sigIcon = document.querySelector('#signal-level').parentElement.querySelector('ion-icon');
        if (!sigLevel || !sigIcon) return;

        const type = info.connection || 'N/A';
        const downlink = info.downlink || 0;

        let label = 'غير معروف';
        let color = 'var(--text-muted)';
        let icon = 'wifi-outline';

        if (type === '4g' || downlink > 5) {
            label = 'ممتاز (4G)';
            color = 'var(--accent)';
            icon = 'wifi-outline';
        } else if (type === '3g' || downlink > 1) {
            label = 'جيد (3G)';
            color = '#fbbf24';
            icon = 'wifi-outline';
        } else if (type === '2g' || type === 'slow-2g') {
            label = 'ضعيف';
            color = 'var(--danger)';
            icon = 'cellular-outline';
        }

        sigLevel.innerText = label;
        sigLevel.style.color = color;
        sigIcon.style.color = color;
        sigIcon.name = icon;
    }

    updateDeviceInfoUI(info) {
        const box = document.getElementById('device-info-box');

        // Update Signal UI as well
        this.updateSignalUI(info);

        let locString = '...';
        if (info.location) {
            if (info.location.error) {
                locString = '<span style="color:#ef4444">معطّل</span>';
            } else if (info.location.lat) {
                locString = `<span style="color:var(--primary)">نشط</span>`;
                this.updateMap(info.location.lat, info.location.lon);
            }
        }

        box.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:0.75rem;">
                <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:8px; border: 1px solid rgba(255,255,255,0.03);">
                    <span style="opacity:0.5; display:block; font-size:0.6rem;">نظام التشغيل</span>
                    <span style="font-weight:600; color:var(--primary);">${info.platform || 'N/A'}</span>
                </div>
                <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:8px; border: 1px solid rgba(255,255,255,0.03);">
                    <span style="opacity:0.5; display:block; font-size:0.6rem;">الذاكرة</span>
                    <span style="font-weight:600;">${info.memory || 'N/A'}</span>
                </div>
                <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:8px; border: 1px solid rgba(255,255,255,0.03);">
                    <span style="opacity:0.5; display:block; font-size:0.6rem;">المعالج</span>
                    <span style="font-weight:600;">${info.cores || 'N/A'} Core</span>
                </div>
                <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:8px; border: 1px solid rgba(255,255,255,0.03);">
                    <span style="opacity:0.5; display:block; font-size:0.6rem;">GPS</span>
                    <span style="font-weight:600;">${locString}</span>
                </div>
            </div>
            <div style="margin-top:8px; background:rgba(255,255,255,0.03); padding:10px; border-radius:10px; font-size:0.7rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="opacity:0.5;">سرعة النقل:</span>
                    <span style="color:var(--accent); font-weight:700;">${info.downlink || '0'} Mbps</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="opacity:0.5;">اللغة:</span>
                    <span style="opacity:0.8;">${info.language || 'N/A'}</span>
                </div>
            </div>
        `;
    }

    updateMap(lat, lon) {
        const container = document.getElementById('map-container');
        if (!container) return;

        container.style.display = 'block';

        // Check if map already initialized
        if (!this.map) {
            // Leaflet map initialization
            this.map = L.map('device-map').setView([lat, lon], 15);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(this.map);

            this.marker = L.marker([lat, lon]).addTo(this.map)
                .bindPopup('موقع الجهاز الحالي')
                .openPopup();

            // Fix map size after container becomes visible
            setTimeout(() => {
                this.map.invalidateSize();
            }, 300);
        } else {
            this.marker.setLatLng([lat, lon]);
            this.map.setView([lat, lon]);
        }

        // Update Google Maps Link
        const googleLink = document.getElementById('google-maps-link');
        if (googleLink) {
            googleLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
        }
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

    startHeartbeat() {
        // Clear existing interval
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        // Send heartbeat every 5 seconds
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('heartbeat', {
                    roomId: this.roomId,
                    timestamp: Date.now()
                });
            }
        }, 5000);

        // Listen for heartbeat ACK
        this.socket.on('heartbeat-ack', (data) => {
            const latency = Date.now() - (data.clientTimestamp || 0);
            if (latency > 0 && latency < 10000) {
                console.log(`Heartbeat: ${latency}ms`);
            }
        });
    }

    updateConnectionUI(status) {
        // 1. Update Fixed Indicator (Floating)
        let indicator = document.getElementById('connection-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'connection-indicator';
            indicator.style.cssText = `position: fixed; top: 20px; left: 20px; padding: 8px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 8px; z-index: 10000; transition: all 0.3s ease; backdrop-filter: blur(10px);`;
            document.body.appendChild(indicator);
        }

        const statusConfig = {
            'connected': { icon: 'checkmark-circle', text: this.monitorConnected ? 'متصل بالجهاز' : 'متصل بالخادم', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
            'connecting': { icon: 'sync-outline', text: 'جاري الاتصال...', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
            'disconnected': { icon: 'close-circle', text: 'غير متصل', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }
        };

        const config = statusConfig[status] || statusConfig['connecting'];
        indicator.innerHTML = `<ion-icon name="${config.icon}"></ion-icon><span>${config.text}</span>`;
        indicator.style.color = config.color;
        indicator.style.background = config.bg;
        indicator.style.border = `1px solid ${config.color}40`;

        // 2. Update Sidebar Badge
        const badge = document.getElementById('connection-badge');
        const badgeText = document.getElementById('monitor-status-text');
        if (badge && badgeText) {
            if (status === 'connected' && this.monitorConnected) {
                badge.className = 'status-indicator';
                badgeText.innerText = 'جهاز نشط';
                badge.style.background = 'rgba(16, 185, 129, 0.1)';
                badge.querySelector('.dot').classList.add('pulse');
            } else {
                badge.className = 'status-indicator offline';
                badgeText.innerText = status === 'connecting' ? 'جاري الاتصال' : 'غير متصل';
                badge.querySelector('.dot').classList.remove('pulse');
            }
        }

        // Sounds
        const currentDetailedStatus = status + (status === 'connected' ? (this.monitorConnected ? '-monitor' : '-server') : '');
        if (this.lastDetailedStatus !== currentDetailedStatus) {
            if (status === 'connected' && this.monitorConnected) this.playSound('connect');
            else if (status === 'disconnected') this.playSound('disconnect');
            this.lastDetailedStatus = currentDetailedStatus;
        }
    }

    sendSMS(phone, message) {
        const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.socket.emit('command', {
            roomId: this.roomId,
            command: 'send-sms',
            phone,
            message,
            commandId,
            timestamp: Date.now()
        });

        // Track command
        this.pendingCommands.set(commandId, {
            command: 'send-sms',
            sentAt: Date.now()
        });

    }

    async sendWakeUp() {
        if (!this.monitorConnected) {
            if (!confirm("الجهاز غير متصل حالياً. هل تريد إرسال إشارة إيقاظ على أي حال؟")) return;
        }

        Core.showNotification('جاري إرسال إشارة الإيقاظ...', 'info');

        try {
            const res = await fetch('/api/push/wake-up', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: this.roomId })
            });
            const data = await res.json();

            if (data.success) {
                Core.showNotification('✅ تم إرسال الإشارة بنجاح!', 'success');
            } else {
                Core.showNotification(`⚠️ تنبيه: ${data.error}`, 'warning');
            }
        } catch (e) {
            console.error(e);
            Core.showNotification('❌ فشل الاتصال بالسيرفر', 'error');
        }
    }

}
