const CACHE_NAME = 'cam-watch-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/monitor.html',
    '/viewer.html',
    '/css/style.css',
    '/manifest.json',
    'https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js',
    'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/uuid/8.3.2/uuid.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});
