/**
 * SafeWatch v4.0 - Home/Landing Logic
 */

import { Core } from './core.js';

export class HomeSystem {
    constructor() {
        this.installBtn = document.getElementById('install-pwa-btn');
        this.createBtn = document.getElementById('createable');
        this.sessionInput = document.getElementById('custom-session');
        this.userInput = document.getElementById('user-input');
        this.passInput = document.getElementById('pass-input');
        this.logoutBtn = document.getElementById('logout-home-btn');
        this.loginTriggerBtn = document.getElementById('login-trigger-btn');
        this.deferredPrompt = null;

        this.init();
    }

    init() {
        this.setupAuth();
        this.setupPWA();
        this.setupEvents();
        this.setupSubscriptionForm();
        this.loadConfig();

        // Restore last session name
        const last = localStorage.getItem('sw_last_custom_session');
        if (last) this.sessionInput.value = last;
    }

    async loadConfig() {
        try {
            const res = await fetch('/api/admin/config');
            const data = await res.json();

            // Update Support Email
            if (data.supportEmail) {
                const footerLink = document.getElementById('footer-support-email');
                const footerText = document.getElementById('footer-support-text');
                if (footerLink) footerLink.href = `mailto:${data.supportEmail}`;
                if (footerText) footerText.innerText = `للدعم والاستفسارات: ${data.supportEmail}`;
            }

            // Update Payment Info
            if (data.paymentInfo) {
                const payDisplay = document.getElementById('payment-info-display');
                if (payDisplay) payDisplay.innerText = data.paymentInfo;
            }
        } catch (e) { console.log("Config load failed"); }
    }

    setupAuth() {
        if (localStorage.getItem('sw_auth') === 'true') {
            document.getElementById('login-gate').style.display = 'none';
            if (this.logoutBtn) this.logoutBtn.style.display = 'inline-flex';
            if (this.loginTriggerBtn) this.loginTriggerBtn.style.display = 'none';
        } else {
            // Keep it hidden by default, or show logic only when needed
            document.getElementById('login-gate').style.display = 'none';
            if (this.logoutBtn) this.logoutBtn.style.display = 'none';
            if (this.loginTriggerBtn) this.loginTriggerBtn.style.display = 'inline-flex';
        }

        if (this.logoutBtn) {
            this.logoutBtn.onclick = () => {
                localStorage.removeItem('sw_auth');
                location.reload();
            };
        }
    }

    async checkPassword() {
        const username = this.userInput.value.trim();
        const password = this.passInput.value.trim();

        if (!username || !password) return alert("يرجى إدخال اسم المستخدم وكلمة المرور");

        try {
            const res = await fetch('/api/customer/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (data.success) {
                localStorage.setItem('sw_auth', 'true');
                localStorage.setItem('sw_user_name', data.name);
                document.getElementById('login-gate').style.display = 'none';
                if (this.logoutBtn) this.logoutBtn.style.display = 'inline-flex';
                if (this.loginTriggerBtn) this.loginTriggerBtn.style.display = 'none';
            } else {
                alert(data.message || "بيانات الدخول غير صحيحة");
            }
        } catch (e) {
            alert("حدث خطأ في الاتصال بالسيرفر");
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
            // Check authentication first
            if (localStorage.getItem('sw_auth') !== 'true') {
                document.getElementById('login-gate').style.display = 'flex';
                return;
            }

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

            // 🚀 Use Fetch API instead of Socket for reliability
            try {
                const response = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        email,
                        phone,
                        receipt: this.receiptData
                    })
                });

                const result = await response.json();

                if (result.success) {
                    status.innerText = "✅ تم إرسال طلبك بنجاح! سنقوم بمراجعته وإرسال البيانات لبريدك قريباً.";
                    status.style.color = "var(--accent)";
                    form.reset();
                    preview.style.display = 'none';
                    label.innerText = "اضغط لرفع صورة الإيصال أو التحويل";
                    btn.style.display = 'none';
                } else {
                    throw new Error(result.error || "خطأ غير معروف");
                }
            } catch (err) {
                console.error('Fetch error:', err);
                status.innerText = "❌ حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى أو مراسلتنا مباشرة.";
                status.style.color = "var(--danger)";
                btn.disabled = false;
                btn.innerText = "إرسال طلب التفعيل";
            }
        };
    }
}
