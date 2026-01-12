/**
 * SafeWatch Admin Logic
 */

class AdminSystem {
    constructor() {
        this.token = sessionStorage.getItem('admin_token');
        this.currentUser = 'admin';
        this.init();
    }

    init() {
        if (this.token) {
            this.showApp();
        }

        document.getElementById('admin-login-btn').onclick = () => this.login();
        this.loadSubscriptions();
    }

    async login() {
        const user = document.getElementById('admin-user').value;
        const pass = document.getElementById('admin-pass').value;

        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });

            const data = await res.json();
            if (data.success) {
                this.token = data.token;
                this.currentUser = user;
                sessionStorage.setItem('admin_token', this.token);
                this.showApp();
            } else {
                alert(data.message);
            }
        } catch (err) {
            alert("حدث خطأ في الاتصال بالسيرفر");
        }
    }

    showApp() {
        document.getElementById('admin-login-gate').style.display = 'none';
        document.getElementById('admin-app').style.display = 'flex';
        this.loadSubscriptions();
    }

    async loadSubscriptions() {
        if (!this.token) return;

        try {
            const res = await fetch('/api/admin/subscriptions');
            const data = await res.json();
            this.renderSubscriptions(data);
        } catch (err) {
            console.error("Failed to load subs", err);
        }
    }

    renderSubscriptions(subs) {
        const list = document.getElementById('subs-list');
        list.innerHTML = '';

        let total = subs.length;
        let pending = 0;

        subs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(sub => {
            if (sub.status === 'pending') pending++;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div style="font-weight: 700;">${sub.name}</div>
                    <div style="font-size: 0.7rem; color: #94a3b8;">ID: ${sub.id}</div>
                </td>
                <td>
                    <div><ion-icon name="mail-outline"></ion-icon> ${sub.email}</div>
                    <div style="color: #94a3b8; font-size: 0.8rem;"><ion-icon name="logo-whatsapp"></ion-icon> ${sub.phone || 'N/A'}</div>
                </td>
                <td>
                    <img src="/receipts/${sub.receiptFileName}" class="receipt-thumb" onclick="window.viewImage('/receipts/${sub.receiptFileName}')">
                </td>
                <td style="font-size: 0.8rem; color: #94a3b8;">
                    ${new Date(sub.timestamp).toLocaleString('ar-EG')}
                </td>
                <td>
                    <span class="status-badge status-${sub.status}">
                        ${sub.status === 'pending' ? 'بانتظار التأكيد' : 'تم التفعيل'}
                    </span>
                </td>
                <td>
                    ${sub.status === 'pending' ?
                    `<button class="btn" style="padding: 5px 12px; font-size: 0.8rem;" onclick="window.openConfirmModal(${sub.id}, '${sub.name}', '${sub.email}')">تفعيل</button>` :
                    `<ion-icon name="checkmark-done" style="color: var(--accent); font-size: 1.5rem;"></ion-icon>`
                }
                </td>
            `;
            list.appendChild(row);
        });

        document.getElementById('total-subs').innerText = total;
        document.getElementById('pending-subs').innerText = pending;
    }

    async updateSubStatus(id, status) {
        try {
            await fetch('/api/admin/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status })
            });
            this.loadSubscriptions();
        } catch (e) {
            alert("فشل تحديث الحالة");
        }
    }

    async changeAdminPassword() {
        const newPass = document.getElementById('new-admin-pass').value;
        if (!newPass) return alert("يرجى إدخال كلمة المرور الجديدة");

        try {
            const res = await fetch('/api/admin/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: this.currentUser, newPassword: newPass })
            });
            if ((await res.json()).success) {
                alert("تم تغيير كلمة المرور بنجاح");
                document.getElementById('new-admin-pass').value = '';
            }
        } catch (e) {
            alert("فشل تغيير كلمة المرور");
        }
    }
}

// Global window helpers for the HTML onclicks
const admin = new AdminSystem();

window.showView = (view) => {
    document.getElementById('view-subs').style.display = view === 'subs' ? 'block' : 'none';
    document.getElementById('view-settings').style.display = view === 'settings' ? 'block' : 'none';
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    event.currentTarget.classList.add('active');
};

window.logout = () => {
    sessionStorage.removeItem('admin_token');
    location.reload();
};

window.viewImage = (src) => {
    document.getElementById('full-image').src = src;
    document.getElementById('image-modal').style.display = 'flex';
};

window.closeImageModal = () => {
    document.getElementById('image-modal').style.display = 'none';
};

window.openConfirmModal = (id, name, email) => {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('modal-desc').innerText = `أنت على وشك تفعيل حساب المشترك: ${name}`;

    // Generate some random temp creds
    document.getElementById('send-user').value = name.split(' ')[0].toLowerCase() + Math.floor(Math.random() * 1000);
    document.getElementById('send-pass').value = Math.random().toString(36).substring(7).toUpperCase();

    modal.style.display = 'flex';

    document.getElementById('confirm-action-btn').onclick = async () => {
        const u = document.getElementById('send-user').value;
        const p = document.getElementById('send-pass').value;

        // Prepare email link
        const subject = encodeURIComponent("تفعيل اشتراكك في برج المراقبة 🛡️");
        const msgBody = `مرحباً ${name}،\n\nتم تأكيد دفع اشتراكك بنجاح في منظومة برج المراقبة.\n\nإليك بيانات الدخول الخاصة بك:\n--------------------------\nاسم المستخدم: ${u}\nكلمة المرور: ${p}\n--------------------------\n\nيمكنك تسجيل الدخول الآن عبر الرابط التالي:\n${window.location.origin}\n\nشكراً لثقتكم بنا.\nإدارة برج المراقبة`;

        const mailtoLink = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(msgBody)}`;

        // Trigger the email client
        window.location.href = mailtoLink;

        // Update status in database
        await admin.updateSubStatus(id, 'confirmed');

        alert(`تم تفعيل الحساب وإرسال البيانات إلى الإيميل: ${email}\n\nيرجى التحقق من تطبيق البريد الإلكتروني لديك لإكمال عملية الإرسال.`);
        modal.style.display = 'none';
    };
};

window.closeModal = () => {
    document.getElementById('confirm-modal').style.display = 'none';
};

window.loadSubscriptions = () => admin.loadSubscriptions();
window.changeAdminPassword = () => admin.changeAdminPassword();
