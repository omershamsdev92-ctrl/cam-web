// SafeWatch Server - Triggering redeploy after Render timeout
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Data Initialization
const receiptsDir = path.join(__dirname, 'receipts');
if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir);

const ADMIN_DATA_PATH = path.join(__dirname, 'admins.json');
if (!fs.existsSync(ADMIN_DATA_PATH)) {
    fs.writeFileSync(ADMIN_DATA_PATH, JSON.stringify([{ username: 'admin', password: 'password2026' }]));
}

const CONFIG_PATH = path.join(__dirname, 'config.json');
if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({
        supportEmail: 'info@safewatch-sa.com',
        paymentInfo: '💳 طرق الدفع المتاحة: \n- STC Pay \n- تحويل بنكي (الراجحي) \n- PayPal \n\nيرجى التواصل مع الدعم الفني لتزويدك بالتفاصيل.'
    }));
}

// Increase limit for base64 images (receipts)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const io = new Server(server, {
    maxHttpBufferSize: 1e7 // 10MB limit for socket payloads
});

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
app.use('/receipts', express.static(path.join(__dirname, 'receipts')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 📩 Subscription API (REST is more reliable for large file uploads than socket)
app.post('/api/subscribe', async (req, res) => {
    const data = req.body;
    console.log(`📩 New POST Subscription Request from: ${data.name} (${data.email})`);

    try {
        if (!data.receipt) throw new Error("Missing receipt data");

        // Save receipt image
        const base64Data = data.receipt.replace(/^data:image\/\w+;base64,/, "");
        const fileName = `receipt_${Date.now()}_${data.name.replace(/\s+/g, '_')}.png`;
        const filePath = path.join(receiptsDir, fileName);

        fs.writeFileSync(filePath, base64Data, 'base64');

        // Save to JSON for Admin Panel
        const subDataPath = path.join(receiptsDir, 'subscriptions.json');
        let subscriptions = [];
        if (fs.existsSync(subDataPath)) {
            subscriptions = JSON.parse(fs.readFileSync(subDataPath, 'utf8'));
        }

        const newSub = {
            id: Date.now(),
            name: data.name,
            email: data.email,
            phone: data.phone,
            receiptFileName: fileName,
            timestamp: new Date().toISOString(),
            status: 'pending' // pending, confirmed, rejected
        };
        subscriptions.push(newSub);
        fs.writeFileSync(subDataPath, JSON.stringify(subscriptions, null, 2));

        console.log(`✓ Receipt saved via API: ${fileName}`);
        res.json({ success: true });
    } catch (err) {
        console.error('✗ Failed to save subscription via API:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 🔐 Admin Auth & Panel Routes
app.get('/api/admin/config', (req, res) => {
    if (fs.existsSync(CONFIG_PATH)) {
        res.json(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
    } else {
        res.json({ supportEmail: 'support@safewatch.com' });
    }
});

app.post('/api/admin/config', (req, res) => {
    const config = req.body;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    res.json({ success: true });
});

// 🏠 Customer Login Verification
app.post('/api/customer/login', (req, res) => {
    const { username, password } = req.body;

    // 1. Priority: System Admin Fallback
    if (username === 'admin' && password === 'dev2000') {
        return res.json({ success: true, name: 'المسؤول الأساسي' });
    }

    // 2. Customer Subscriptions
    const subPath = path.join(__dirname, 'receipts', 'subscriptions.json');
    if (fs.existsSync(subPath)) {
        const subs = JSON.parse(fs.readFileSync(subPath, 'utf8'));
        const found = subs.find(s => s.status === 'confirmed' && s.username === username && s.password === password);
        if (found) {
            return res.json({ success: true, name: found.name });
        }
    }

    res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة أو الحساب لم يتم تفعيله بعد'
    });
});

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const admins = JSON.parse(fs.readFileSync(ADMIN_DATA_PATH, 'utf8'));
    const admin = admins.find(a => a.username === username && a.password === password);

    if (admin) {
        // In a real app we'd use JWT/Sessions. For simplicity, we'll use a plain success
        res.json({ success: true, token: 'admin-token-' + Date.now() });
    } else {
        res.status(401).json({ success: false, message: 'خطأ في اسم المستخدم أو كلمة المرور' });
    }
});

// 👥 Admin Management Routes
app.get('/api/admin/list', (req, res) => {
    const admins = JSON.parse(fs.readFileSync(ADMIN_DATA_PATH, 'utf8'));
    res.json(admins.map(a => ({ username: a.username })));
});

app.post('/api/admin/add', (req, res) => {
    const { username, password } = req.body;
    let admins = JSON.parse(fs.readFileSync(ADMIN_DATA_PATH, 'utf8'));
    if (admins.find(a => a.username === username)) {
        return res.status(400).json({ success: false, message: 'اسم المستخدم موجود بالفعل' });
    }
    admins.push({ username, password });
    fs.writeFileSync(ADMIN_DATA_PATH, JSON.stringify(admins, null, 2));
    res.json({ success: true });
});

app.post('/api/admin/delete', (req, res) => {
    const { username } = req.body;
    if (username === 'admin') return res.status(400).json({ success: false, message: 'لا يمكن حذف حساب المسؤول الرئيسي' });

    let admins = JSON.parse(fs.readFileSync(ADMIN_DATA_PATH, 'utf8'));
    const initialLen = admins.length;
    admins = admins.filter(a => a.username !== username);

    if (admins.length === initialLen) return res.status(404).json({ success: false, message: 'المسؤول غير موجود' });

    fs.writeFileSync(ADMIN_DATA_PATH, JSON.stringify(admins, null, 2));
    res.json({ success: true });
});

app.get('/api/admin/subscriptions', (req, res) => {
    // Basic auth check would go here
    const subPath = path.join(__dirname, 'receipts', 'subscriptions.json');
    if (fs.existsSync(subPath)) {
        res.json(JSON.parse(fs.readFileSync(subPath, 'utf8')));
    } else {
        res.json([]);
    }
});

app.post('/api/admin/change-password', (req, res) => {
    const { username, newPassword } = req.body;
    const admins = JSON.parse(fs.readFileSync(ADMIN_DATA_PATH, 'utf8'));
    const idx = admins.findIndex(a => a.username === username);
    if (idx !== -1) {
        admins[idx].password = newPassword;
        fs.writeFileSync(ADMIN_DATA_PATH, JSON.stringify(admins, null, 2));
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

app.post('/api/admin/update-status', (req, res) => {
    const { id, status, username, password } = req.body;
    const subPath = path.join(__dirname, 'receipts', 'subscriptions.json');
    if (fs.existsSync(subPath)) {
        let subs = JSON.parse(fs.readFileSync(subPath, 'utf8'));
        const idx = subs.findIndex(s => s.id == id);
        if (idx !== -1) {
            subs[idx].status = status;
            if (username && password) {
                subs[idx].username = username;
                subs[idx].password = password;
            }
            fs.writeFileSync(subPath, JSON.stringify(subs, null, 2));
            res.json({ success: true });
        } else res.status(404).json({ success: false });
    } else res.status(404).json({ success: false });
});

// Store active connections with metadata
const connections = new Map();

// Socket.io Signaling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Track connection
    connections.set(socket.id, {
        connectedAt: Date.now(),
        lastHeartbeat: Date.now(),
        role: null,
        roomId: null
    });

    // Join a specific room (session)
    socket.on('join-room', (roomId, role) => {
        socket.join(roomId);
        socket.role = role; // 'monitor' (camera) or 'viewer' (dashboard)
        socket.roomId = roomId;

        // Update connection metadata
        const conn = connections.get(socket.id);
        if (conn) {
            conn.role = role;
            conn.roomId = roomId;
        }

        console.log(`✓ ${role} joined room: ${roomId} (ID: ${socket.id.substr(0, 8)})`);

        // Notify others in the room with detailed info
        socket.to(roomId).emit('user-connected', {
            role,
            socketId: socket.id,
            timestamp: Date.now()
        });

        // If a viewer joins, check if monitor is already present
        if (role === 'viewer') {
            const monitor = Array.from(io.sockets.adapter.rooms.get(roomId) || [])
                .map(id => io.sockets.sockets.get(id))
                .find(s => s && s.role === 'monitor');

            if (monitor) {
                // Monitor is here! Tell the new viewer
                socket.emit('monitor-ready', { roomId, alreadyPresent: true });
                // Also ask monitor to refresh its device info for the new guy
                monitor.emit('request-monitor-status');
            } else {
                // Monitor not here, but still ask in case of desync
                socket.to(roomId).emit('request-monitor-status');
            }
        }

        // Send current room status to the joiner
        const roomClients = io.sockets.adapter.rooms.get(roomId);
        if (roomClients) {
            socket.emit('room-status', {
                roomId,
                clientCount: roomClients.size,
                timestamp: Date.now()
            });
        }
    });

    // Heartbeat system
    socket.on('heartbeat', (data) => {
        const conn = connections.get(socket.id);
        if (conn) {
            conn.lastHeartbeat = Date.now();
        }

        // Echo back with server timestamp
        socket.emit('heartbeat-ack', {
            clientTimestamp: data?.timestamp,
            serverTimestamp: Date.now()
        });
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

    // New unified command system with ACK
    socket.on('command', async (payload) => {
        const commandId = payload.commandId || `cmd_${Date.now()}`;
        console.log(`📤 Command [${commandId}]: ${payload.command} for room: ${payload.roomId}`);

        // Handle SMS via Twilio if configured
        if (payload.command === 'send-sms' && twilioClient) {
            try {
                const message = await twilioClient.messages.create({
                    body: payload.message,
                    from: process.env.TWILIO_PHONE,
                    to: payload.phone
                });

                console.log('✓ SMS sent via Twilio:', message.sid);
                socket.emit('command-ack', {
                    commandId,
                    status: 'success',
                    message: 'SMS sent via server',
                    timestamp: Date.now()
                });

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

        // Forward command to monitor device in the room
        const sentCount = io.to(payload.roomId).emit('command', {
            ...payload,
            commandId,
            serverTimestamp: Date.now()
        });

        console.log(`📡 Command forwarded to ${payload.roomId}`);

        // Notify sender that command was forwarded
        socket.emit('command-sent', {
            commandId,
            command: payload.command,
            timestamp: Date.now()
        });
    });

    // Command acknowledgment from monitor
    socket.on('command-ack', (payload) => {
        console.log(`✅ Command ACK [${payload.commandId}]:`, payload.status);

        // Forward ACK to the viewer
        socket.to(payload.roomId).emit('command-ack', payload);
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

    // 📩 Subscription Socket Handling (Keeping as fallback or removing if redundant)
    socket.on('subscription-request', (data) => {
        // We'll keep this just in case, but prefer the REST API now
        console.log("Socket subscription request received - prefer API");
    });

    socket.on('disconnect', () => {
        const conn = connections.get(socket.id);
        if (conn) {
            console.log(`Client disconnected: ${socket.id.substr(0, 8)} (${conn.role} in ${conn.roomId})`);

            // Notify room members
            if (conn.roomId) {
                socket.to(conn.roomId).emit('user-disconnected', {
                    role: conn.role,
                    socketId: socket.id,
                    timestamp: Date.now()
                });
            }

            connections.delete(socket.id);
        } else {
            console.log('Client disconnected:', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
