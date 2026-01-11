/**
 * SafeWatch v4.0 - Home/Landing Logic
 */

import { Core } from './core.js';

export class HomeSystem {
    constructor() {
        this.installBtn = document.getElementById('install-pwa-btn');
        this.createBtn = document.getElementById('createable');
        this.sessionInput = document.getElementById('custom-session');
        this.passInput = document.getElementById('pass-input');
        this.deferredPrompt = null;

        this.init();
    }

    init() {
        this.setupAuth();
        this.setupPWA();
        this.setupEvents();

        // Restore last session name
        const last = localStorage.getItem('sw_last_custom_session');
        if (last) this.sessionInput.value = last;
    }

    setupAuth() {
        if (localStorage.getItem('sw_auth') === 'true') {
            document.getElementById('login-gate').style.display = 'none';
        }
    }

    checkPassword() {
        if (this.passInput.value === 'dev2000') {
            localStorage.setItem('sw_auth', 'true');
            document.getElementById('login-gate').style.display = 'none';
        } else {
            alert("كلمة المرور غير صحيحة!");
        }
    }

    setupPWA() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.installBtn.style.display = 'inline-block';
        });

        this.installBtn.onclick = async () => {
            if (this.deferredPrompt) {
                this.deferredPrompt.prompt();
                await this.deferredPrompt.userChoice;
                this.deferredPrompt = null;
                this.installBtn.style.display = 'none';
            }
        };
    }

    setupEvents() {
        const createSession = (mode = 'video') => {
            const val = this.sessionInput.value.trim();
            if (val) localStorage.setItem('sw_last_custom_session', val);

            const roomId = val || 'sw-' + Math.random().toString(36).substring(2, 10);
            const btn = mode === 'video' ? this.createBtn : document.getElementById('create-audio-only');

            btn.disabled = true;
            btn.innerHTML = '<ion-icon name="sync-outline" class="pulsing"></ion-icon> جاري التنشيط...';

            setTimeout(() => {
                let url = `viewer.html?session=${encodeURIComponent(roomId)}`;
                if (mode === 'audio') url += `&mode=audio`;
                window.location.href = url;
            }, 500);
        };

        this.createBtn.onclick = () => createSession('video');

        const audioBtn = document.getElementById('create-audio-only');
        if (audioBtn) audioBtn.onclick = () => createSession('audio');
    }
}
