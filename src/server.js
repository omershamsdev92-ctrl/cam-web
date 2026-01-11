const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Twilio SMS Configuration (Optional - requires account)
let twilioClient = null;
try {
    const twilio = require('twilio');
    const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    const TWILIO_PHONE = process.env.TWILIO_PHONE;

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE) {
        twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        console.log('✓ Twilio SMS service enabled');
    } else {
        console.log('⚠ Twilio not configured - SMS will use device method');
    }
} catch (e) {
    console.log('⚠ Twilio module not installed - SMS will use device method');
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io Signaling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join a specific room (session)
    socket.on('join-room', (roomId, role) => {
        socket.join(roomId);
        socket.role = role; // 'monitor' (camera) or 'viewer' (dashboard)
        socket.roomId = roomId;
        console.log(`${role} joined room: ${roomId}`);

        // Notify others in the room
        socket.to(roomId).emit('user-connected', role);

        // If a viewer joins, ask monitor to announce itself
        if (role === 'viewer') {
            socket.to(roomId).emit('request-monitor-status');
        }
    });

    // Monitor response to status request
    socket.on('monitor-announcement', (payload) => {
        socket.to(payload.roomId).emit('monitor-ready', payload);
    });

    // WebRTC Signaling
    socket.on('offer', (payload) => {
        // payload: { target: socketId, sdp: sessionDescription, roomId }
        socket.to(payload.roomId).emit('offer', payload);
    });

    socket.on('answer', (payload) => {
        socket.to(payload.roomId).emit('answer', payload);
    });

    socket.on('ice-candidate', (payload) => {
        socket.to(payload.roomId).emit('ice-candidate', payload);
    });

    // Camera Controls (Viewer -> Monitor)
    socket.on('control-command', (payload) => {
        // payload: { roomId, command, value }
        // command: 'switch-camera', 'toggle-torch', 'set-quality'
        socket.to(payload.roomId).emit('control-command', payload);
    });

    // New unified command system
    socket.on('command', async (payload) => {
        console.log('Command received:', payload.command, 'for room:', payload.roomId);

        // Handle SMS via Twilio if configured
        if (payload.command === 'send-sms' && twilioClient) {
            try {
                const message = await twilioClient.messages.create({
                    body: payload.message,
                    from: process.env.TWILIO_PHONE,
                    to: payload.phone
                });

                console.log('✓ SMS sent via Twilio:', message.sid);
                socket.emit('status-update', {
                    roomId: payload.roomId,
                    type: 'sms-sent-server',
                    phone: payload.phone,
                    success: true,
                    timestamp: Date.now()
                });
                return; // Don't forward to device
            } catch (error) {
                console.error('✗ Twilio SMS failed:', error.message);
                // Fall back to device method
            }
        }

        // Forward command to device
        socket.to(payload.roomId).emit('command', payload);
    });

    // Status updates (Monitor -> Viewer)
    socket.on('status-update', (payload) => {
        socket.to(payload.roomId).emit('status-update', payload);
    });

    socket.on('device-info', (payload) => {
        socket.to(payload.roomId).emit('device-info', payload);
    });

    // Fallback Stream Relay (Images via WebSocket)
    socket.on('stream-data', (payload) => {
        // payload: { roomId, image: 'base64...', isSnapshot: true/false }
        socket.to(payload.roomId).emit('stream-data', payload);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
