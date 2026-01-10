const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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
        console.log(`${role} joined room: ${roomId}`);

        // Notify others in the room
        socket.to(roomId).emit('user-connected', role);
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

    // Status updates (Monitor -> Viewer)
    socket.on('status-update', (payload) => {
        socket.to(payload.roomId).emit('status-update', payload);
    });

    // Fallback Stream Relay (Images via WebSocket)
    socket.on('stream-data', (payload) => {
        // payload: { roomId, image: 'base64...', isSnapshot: true/false }
        socket.volatile.to(payload.roomId).emit('stream-data', payload);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
