/**
 * SafeWatch Admin Logic
 */

class AdminSystem {
    constructor() {
        this.token = sessionStorage.getItem('admin_token');
        this.currentUser = 'admin';
        this.supportEmail = '';
        this.paymentInfo = '';
        this.allSubscriptions = [];
        this.init();
    }

    async init() {
        if (this.token) {
            this.showApp();
        }

        document.getElementById('admin-login-btn').onclick = () => this.login();

        const searchInput = document.getElementById('sub-search');
        if (searchInput) {
            searchInput.oninput = () => this.filterSubscriptions();
        }

        this.loadSubscriptions();
        this.loadConfig();
    }

    async loadConfig() {
        try {
            const res = await fetch('/api/admin/config');
            const data = await res.json();
            this.supportEmail = data.supportEmail;
            this.paymentInfo = data.paymentInfo || '';

            const emailInput = document.getElementById('support-email-input');
            const paymentInput = document.getElementById('payment-info-input');

            if (emailInput) emailInput.value = this.supportEmail;
            if (paymentInput) paymentInput.value = this.paymentInfo;
        } catch (e) { console.error("Config load error", e); }
    }

    async saveAdminSettings() {
        const email = document.getElementById('support-email-input').value;
        const payment = document.getElementById('payment-info-input').value;
        try {
            await fetch('/api/admin/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supportEmail: email,
                    paymentInfo: payment
                })
            });
            this.supportEmail = email;
            this.paymentInfo = payment;
            alert("✅ تم حفظ الإعدادات بنجاح");
        } catch (e) { alert("❌ فشل الحفظ"); }
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
            this.allSubscriptions = await res.json();
            this.renderSubscriptions(this.allSubscriptions);
        } catch (err) {
            console.error("Failed to load subs", err);
        }
    }

    filterSubscriptions() {
        const query = document.getElementById('sub-search').value.toLowerCase();
        const filtered = this.allSubscriptions.filter(s =>
            s.name.toLowerCase().includes(query) ||
            s.email.toLowerCase().includes(query)
        );
        this.renderSubscriptions(filtered);
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
                    `<button class="btn" style="padding: 5px 12px; font-size: 0.8rem; background: var(--accent);" 
                        onclick="window.viewCreds(${sub.id})">
                        <ion-icon name="key-outline"></ion-icon> عرض البيانات
                    </button>`
                }
                </td>
            `;
            list.appendChild(row);
        });

        document.getElementById('total-subs').innerText = total;
        document.getElementById('pending-subs').innerText = pending;
    }

    async updateSubStatus(id, status, extra = {}) {
        try {
            await fetch('/api/admin/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status, ...extra })
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

    async loadAdmins() {
        try {
            const res = await fetch('/api/admin/list');
            const admins = await res.json();
            this.renderAdmins(admins);
        } catch (e) { console.error("Admin load error", e); }
    }

    renderAdmins(admins) {
        const list = document.getElementById('admins-list');
        if (!list) return;
        list.innerHTML = '';
        admins.forEach(a => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong style="color: #fff;">${a.username}</strong></td>
                <td>
                    ${a.username === 'admin' ?
                    '<span style="color: #94a3b8; font-size: 0.8rem;">المسؤول الرئيسي</span>' :
                    `<button class="btn" style="padding: 5px 10px; background: #ef4444; font-size: 0.8rem;" onclick="window.deleteAdmin('${a.username}')">حذف</button>`
                }
                </td>
            `;
            list.appendChild(row);
        });
    }

    async addAdmin() {
        const user = document.getElementById('new-admin-user').value;
        const pass = document.getElementById('new-admin-pass-raw').value;
        if (!user || !pass) return alert("يرجى تعبئة جميع الخانات");

        try {
            const res = await fetch('/api/admin/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });
            const data = await res.json();
            if (data.success) {
                alert("✅ تم إضافة المسؤول بنجاح");
                document.getElementById('new-admin-user').value = '';
                document.getElementById('new-admin-pass-raw').value = '';
                this.loadAdmins();
            } else {
                alert(data.message);
            }
        } catch (e) { alert("حدث خطأ"); }
    }

    async deleteAdmin(username) {
        if (!confirm(`هل أنت متأكد من حذف المسؤول: ${username}؟`)) return;

        try {
            const res = await fetch('/api/admin/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            if ((await res.json()).success) {
                alert("✅ تم الحذف بنجاح");
                this.loadAdmins();
            }
        } catch (e) { alert("فشل الحذف"); }
    }
}

// Global window helpers for the HTML onclicks
const admin = new AdminSystem();

window.showView = (view) => {
    document.getElementById('view-subs').style.display = view === 'subs' ? 'block' : 'none';
    document.getElementById('view-settings').style.display = view === 'settings' ? 'block' : 'none';
    document.getElementById('view-admins').style.display = view === 'admins' ? 'block' : 'none';

    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if (event) event.currentTarget.classList.add('active');

    if (view === 'admins') admin.loadAdmins();
    if (view === 'subs') admin.loadSubscriptions();
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
    const step1 = document.getElementById('modal-step-1');
    const stepSuccess = document.getElementById('modal-step-success');

    document.getElementById('modal-desc').innerText = `أنت على وشك تفعيل حساب المشترك: ${name}`;

    // Reset view
    step1.style.display = 'block';
    stepSuccess.style.display = 'none';
    stepSuccess.querySelector('h3').innerText = "تم تفعيل الحساب!";

    // Generate some random temp creds
    const sugUser = name.split(' ')[0].toLowerCase() + Math.floor(Math.random() * 1000);
    const sugPass = Math.random().toString(36).substring(7).toUpperCase();

    document.getElementById('send-user').value = sugUser;
    document.getElementById('send-pass').value = sugPass;

    modal.style.display = 'flex';

    document.getElementById('confirm-action-btn').onclick = async () => {
        const u = document.getElementById('send-user').value;
        const p = document.getElementById('send-pass').value;

        // Save to database
        await admin.updateSubStatus(id, 'confirmed', { username: u, password: p });

        // Show success state
        document.getElementById('final-user').innerText = u;
        document.getElementById('final-pass').innerText = p;
        step1.style.display = 'none';
        stepSuccess.style.display = 'block';

        const subject = "تفعيل اشتراكك في برج المراقبة 🛡️";
        const msgBody = `مرحباً ${name}،\n\nتم تأكيد دفع اشتراكك بنجاح في منظومة برج المراقبة.\n\nإليك بيانات الدخول الخاصة بك:\n--------------------------\nاسم المستخدم: ${u}\nكلمة المرور: ${p}\n--------------------------\n\nيمكنك تسجيل الدخول الآن عبر الرابط التالي:\n${window.location.origin}\n\nشكراً لثقتكم بنا.\nإدارة برج المراقبة`;

        // Update the email button
        const mailBtn = document.getElementById('open-mail-final');
        mailBtn.querySelector('span').innerText = `فتح تطبيق الإيميل لإرسال البيانات (${email})`;

        mailBtn.onclick = () => {
            window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msgBody)}`;
        };

        // Click this for manual copy if mailto fails
        window.currentEmailTemplate = `المستلم: ${email}\nالموضوع: ${subject}\n\nالرسالة:\n${msgBody}`;

        // Global data for copying
        window.currentCreds = `اسم المستخدم: ${u}\nكلمة المرور: ${p}\nالرابط: ${window.location.origin}`;
        window.currentCustomerEmail = email;
    };
};

window.copyCustomerEmail = () => {
    if (window.currentCustomerEmail) {
        navigator.clipboard.writeText(window.currentCustomerEmail);
        alert("✅ تم نسخ إيميل العميل بنجاح!");
    }
};

window.copyEmailTemplate = () => {
    if (window.currentEmailTemplate) {
        navigator.clipboard.writeText(window.currentEmailTemplate);
        alert("✅ تم نسخ نص الرسالة بالكامل! يمكنك الآن لصقها في Gmail وإرسالها يدوياً.");
    }
};

window.saveAdminSettings = () => admin.saveAdminSettings();

window.copyFinalCreds = () => {
    if (window.currentCreds) {
        navigator.clipboard.writeText(window.currentCreds);
        alert("✅ تم نسخ البيانات (المستخدم وكلمة المرور) بنجاح!");
    }
};

window.viewCreds = (id) => {
    const sub = admin.allSubscriptions.find(s => s.id == id);
    if (!sub || !sub.username) return alert("لا توجد بيانات محفوظة لهذا المشترك");

    const modal = document.getElementById('confirm-modal');
    const step1 = document.getElementById('modal-step-1');
    const stepSuccess = document.getElementById('modal-step-success');
    const title = stepSuccess.querySelector('h3');

    // Setup Success View
    document.getElementById('final-user').innerText = sub.username;
    document.getElementById('final-pass').innerText = sub.password;
    title.innerText = "بيانات الحساب المرجعية";

    // Prepare global data for copying
    const subject = "تفعيل اشتراكك في برج المراقبة 🛡️";
    const msgBody = `مرحباً ${sub.name}،\n\nتم تأكيد دفع اشتراكك بنجاح في منظومة برج المراقبة.\n\nإليك بيانات الدخول الخاصة بك:\n--------------------------\nاسم المستخدم: ${sub.username}\nكلمة المرور: ${sub.password}\n--------------------------\n\nيمكنك تسجيل الدخول الآن عبر الرابط التالي:\n${window.location.origin}\n\nشكراً لثقتكم بنا.\nإدارة برج المراقبة`;

    window.currentEmailTemplate = `المستلم: ${sub.email}\nالموضوع: ${subject}\n\nالرسالة:\n${msgBody}`;
    window.currentCreds = `اسم المستخدم: ${sub.username}\nكلمة المرور: ${sub.password}\nالرابط: ${window.location.origin}`;
    window.currentCustomerEmail = sub.email;

    // Update mail button
    const mailBtn = document.getElementById('open-mail-final');
    mailBtn.querySelector('span').innerText = `إرسال الإيميل مرة أخرى (${sub.email})`;
    mailBtn.onclick = () => {
        window.location.href = `mailto:${sub.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msgBody)}`;
    };

    step1.style.display = 'none';
    stepSuccess.style.display = 'block';
    modal.style.display = 'flex';
};

window.closeModal = () => {
    document.getElementById('confirm-modal').style.display = 'none';
};

window.loadSubscriptions = () => admin.loadSubscriptions();
window.changeAdminPassword = () => admin.changeAdminPassword();
window.addAdmin = () => admin.addAdmin();
window.deleteAdmin = (user) => admin.deleteAdmin(user);
