const CACHE_NAME = 'cam-watch-v6.0';
const ASSETS = [
    '/',
    '/index.html',
    '/monitor.html',
    '/viewer.html',
    '/css/style.css',
    '/js/core.js',
    '/js/home.js',
    '/js/monitor.js',
    '/js/viewer.js',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    // Force wait until new cache is ready
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    // Force clear old caches
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // For local dev and socket.io, bypass cache sometimes, but for core assets try cache first
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});
