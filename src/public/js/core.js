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

    // UI Feedback
    showNotification: (msg, type = 'info') => {
        console.log(`[${type.toUpperCase()}] ${msg}`);
        // Can be expanded to a toast system
    },

    // RTC Configuration
    rtcConfig: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    }
};
