const CACHE_NAME = 'cam-watch-v9.0';
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
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Skip socket.io requests to prevent caching realtime traffic
    if (event.request.url.includes('/socket.io/')) {
        return;
    }

    // Network first for HTML pages to ensure we always get latest session data, fallback to cache
    if (event.request.headers.get('Accept').includes('text/html')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Stale-while-revalidate for static assets (CSS, JS, Images)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Update cache with new version
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            });
            // Return cached response immediately if available, otherwise wait for network
            return cachedResponse || fetchPromise;
        })
    );
});

// --- 🔔 Remote Wake-up Handling ---
self.addEventListener('push', (event) => {
    let data = { title: 'تحديث أمان النظام', body: 'يرجى النقر للمتابعة' };
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: '/images/icon-192.png',
        badge: '/images/icon-192.png',
        data: { url: data.url },
        vibrate: [100, 50, 100],
        actions: [
            { action: 'open', title: 'تحقق الآن' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                for (let client of windowClients) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
