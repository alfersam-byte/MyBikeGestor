// ========================================
// SERVICE WORKER - MyBikeGestor v4.0
// ========================================
const CACHE_NAME = 'mybikegestor-v4';
const ASSETS_TO_CACHE = [
    './manifest.json',
    './logo.png'
];

// Instalación - cachear solo assets estáticos que no cambian
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// Activación - limpiar cachés antiguas
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Siempre red para Firebase, Strava y APIs externas
    if (url.hostname.includes('firebase') ||
        url.hostname.includes('googleapis') ||
        url.hostname.includes('strava') ||
        url.hostname.includes('gstatic')) {
        event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
        return;
    }

    // Ignorar no-GET y extensiones
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    // Network First para index.html — siempre la versión más reciente
    if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
        event.respondWith(
            fetch(event.request).then(response => {
                // Actualizar caché con la versión nueva
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            }).catch(() => {
                // Sin red: servir desde caché como fallback
                return caches.match(event.request) || caches.match('./index.html');
            })
        );
        return;
    }

    // Cache First para el resto de assets estáticos (logo, manifest)
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response && response.status === 200 && response.type !== 'opaque') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
