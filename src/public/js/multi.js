/**
 * SafeWatch v4.0 - Multi-Viewer Module
 */

import { Core } from './core.js';

class MultiViewer {
    constructor() {
        this.sessions = JSON.parse(localStorage.getItem('sw_active_sessions') || '[]');
        this.grid = document.getElementById('multi-grid');
        this.socket = io();
        this.connections = new Map(); // roomId -> { socket, pc, videoEl }

        this.init();
    }

    init() {
        if (this.sessions.length === 0) {
            document.getElementById('no-sessions').style.display = 'block';
            return;
        }

        document.getElementById('active-count').innerText = this.sessions.length;

        this.sessions.forEach(roomId => {
            this.createCamCard(roomId);
        });
    }

    createCamCard(roomId) {
        const card = document.createElement('div');
        card.className = 'cam-card';
        card.innerHTML = `
            <div class="cam-header">
                <span style="font-weight:700; font-size:0.8rem;">ID: ${roomId}</span>
                <div id="badge-${roomId}" class="cam-badge offline">
                     <span class="dot"></span> <span>غير متصل</span>
                </div>
            </div>
            <video id="video-${roomId}" class="cam-video" autoplay playsinline muted></video>
            <div style="padding: 10px; display: flex; gap: 10px; background: rgba(0,0,0,0.2);">
                <button class="btn" style="padding: 5px 10px; font-size: 0.7rem;" onclick="window.enterRoom('${roomId}')">
                    <ion-icon name="expand-outline"></ion-icon> التحكم الكامل
                </button>
                <button class="btn" style="padding: 5px 10px; font-size: 0.7rem; background: var(--danger);" onclick="window.removeRoom('${roomId}')">
                    <ion-icon name="trash-outline"></ion-icon>
                </button>
            </div>
        `;
        this.grid.appendChild(card);

        // Setup individual connection
        this.connectToRoom(roomId);
    }

    connectToRoom(roomId) {
        const socket = io(); // Unique socket per room for simplicity in routing if needed, or use namespace/rooms
        socket.emit('join-room', roomId, 'viewer');

        const videoEl = document.getElementById(`video-${roomId}`);
        let pc = null;

        socket.on('user-connected', (role) => {
            if (role === 'monitor' || role.role === 'monitor') {
                this.updateBadge(roomId, true);
                this.startRTC(roomId, socket, videoEl);
            }
        });

        socket.on('user-disconnected', (data) => {
            if (data.role === 'monitor') this.updateBadge(roomId, false);
        });

        socket.on('answer', async (payload) => {
            const conn = this.connections.get(roomId);
            if (conn && conn.pc) await conn.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        });

        socket.on('ice-candidate', async (payload) => {
            const conn = this.connections.get(roomId);
            if (conn && conn.pc && conn.pc.remoteDescription) {
                await conn.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            }
        });

        this.connections.set(roomId, { socket, pc: null, videoEl });
    }

    async startRTC(roomId, socket, videoEl) {
        const pc = new RTCPeerConnection(Core.rtcConfig);

        pc.onicecandidate = (e) => {
            if (e.candidate) socket.emit('ice-candidate', { roomId, candidate: e.candidate });
        };

        pc.ontrack = (e) => {
            if (e.streams && e.streams[0]) {
                videoEl.srcObject = e.streams[0];
            }
        };

        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { roomId, sdp: offer });

        const conn = this.connections.get(roomId);
        conn.pc = pc;
    }

    updateBadge(roomId, online) {
        const badge = document.getElementById(`badge-${roomId}`);
        if (!badge) return;
        badge.className = online ? 'cam-badge' : 'cam-badge offline';
        badge.querySelector('span:last-child').innerText = online ? 'نشط الآن' : 'غير متصل';
        if (online) badge.querySelector('.dot').classList.add('pulse');
        else badge.querySelector('.dot').classList.remove('pulse');
    }
}

const multi = new MultiViewer();

window.enterRoom = (rid) => {
    window.location.href = `viewer.html?session=${rid}`;
};

window.removeRoom = (rid) => {
    if (confirm('هل تريد إزالة هذا الجهاز من القائمة؟')) {
        let sessions = JSON.parse(localStorage.getItem('sw_active_sessions') || '[]');
        sessions = sessions.filter(s => s !== rid);
        localStorage.setItem('sw_active_sessions', JSON.stringify(sessions));
        window.location.reload();
    }
};
