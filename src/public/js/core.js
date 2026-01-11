/**
 * SafeWatch v4.0 - Core System
 * Shared utilities and initialization
 */

export const Core = {
    // Auth Check
    checkAuth: () => {
        if (localStorage.getItem('sw_auth') !== 'true') {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    },

    // Session Management
    getRoomId: () => {
        const urlParams = new URLSearchParams(window.location.search);
        let roomId = urlParams.get('session');
        if (!roomId) roomId = localStorage.getItem('sw_saved_session');
        if (roomId) localStorage.setItem('sw_saved_session', roomId);
        return roomId;
    },

    getMode: () => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('mode') || 'video';
    },

    // UI Feedback
    showNotification: (msg, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style = `
            position: fixed; top: 20px; right: 20px; padding: 12px 24px;
            background: ${type === 'error' ? '#ef4444' : 'rgba(255,255,255,0.1)'};
            color: white; border-radius: 12px; backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1); z-index: 10000;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
            animation: slideIn 0.3s ease-out;
            font-size: 0.9rem; direction: rtl;
        `;
        toast.innerText = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            toast.style.transition = 'all 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // RTC Configuration
    rtcConfig: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    }
};
