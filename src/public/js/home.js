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
        this.setupSubscriptionForm();

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

    setupSubscriptionForm() {
        const form = document.getElementById('subscription-form');
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('receipt-file');
        const preview = document.getElementById('receipt-preview');
        const label = document.getElementById('file-label');
        const status = document.getElementById('form-status');

        if (!form) return;

        // File Selection Logic
        dropZone.onclick = () => fileInput.click();

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (prev) => {
                    preview.src = prev.target.result;
                    preview.style.display = 'block';
                    label.innerText = `تم اختيار: ${file.name}`;
                    this.receiptData = prev.target.result;
                };
                reader.readAsDataURL(file);
            }
        };

        // Form Submit
        form.onsubmit = async (e) => {
            e.preventDefault();

            const btn = document.getElementById('submit-form-btn');
            const name = document.getElementById('client-name').value;
            const email = document.getElementById('client-email').value;
            const phone = document.getElementById('client-phone').value;

            if (!this.receiptData) {
                alert("يرجى إرفاق صورة الإيصال أولاً");
                return;
            }

            btn.disabled = true;
            btn.innerText = "جاري الإرسال...";
            status.style.display = 'block';
            status.innerText = "جاري معالجة الطلب...";
            status.style.color = "var(--primary)";

            // Emit to server via socket (or you can use fetch if you prefer, but we already have socket.io)
            const socket = io();
            socket.emit('subscription-request', {
                name,
                email,
                phone,
                receipt: this.receiptData,
                timestamp: new Date().toISOString()
            });

            socket.on('subscription-success', () => {
                status.innerText = "✅ تم إرسال طلبك بنجاح! سنقوم بمراجعته وإرسال البيانات لبريدك قريباً.";
                status.style.color = "var(--accent)";
                form.reset();
                preview.style.display = 'none';
                label.innerText = "اضغط لرفع صورة الإيصال أو التحويل";
                btn.style.display = 'none';
            });

            socket.on('subscription-error', (err) => {
                status.innerText = "❌ حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى.";
                status.style.color = "var(--danger)";
                btn.disabled = false;
                btn.innerText = "إرسال طلب التفعيل";
            });
        };
    }
}
