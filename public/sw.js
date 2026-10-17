// Service worker de Finanzas 360.
// - Modo sin conexión: guarda la interfaz (HTML, JS, CSS, fuentes) para que la app abra
//   sin red. Los datos los guarda Firestore en su propia caché.
// - Gestiona el clic en las notificaciones (las de "límite excedido" las dispara la app).
//
// Estrategia:
// - Páginas: primero la red (así cada despliegue llega de inmediato) y, si no hay red o
//   tarda demasiado, la última versión guardada.
// - /assets/* (nombres con hash, nunca cambian) y fuentes: primero la caché.
// - /api/* y todo lo demás: sin tocar.

const CACHE = 'f360-shell-v1';
const MAX_ASSETS = 160;
const ESPERA_RED_MS = 4000;

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.add('/').catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k.startsWith('f360-shell-') && k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

const conTiempo = (promesa, ms) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promesa.then((r) => { clearTimeout(t); resolve(r); }, (e) => { clearTimeout(t); reject(e); });
});

async function recortar(cache) {
    const keys = (await cache.keys()).filter((r) => new URL(r.url).pathname !== '/');
    const sobran = keys.length - MAX_ASSETS;
    for (let i = 0; i < sobran; i++) await cache.delete(keys[i]);
}

async function pagina(request) {
    const cache = await caches.open(CACHE);
    try {
        const res = await conTiempo(fetch(request), ESPERA_RED_MS);
        if (res.ok) cache.put('/', res.clone());
        return res;
    } catch {
        return (await cache.match('/')) || Response.error();
    }
}

async function estatico(request) {
    const cache = await caches.open(CACHE);
    const guardado = await cache.match(request);
    if (guardado) return guardado;
    const res = await fetch(request);
    if (res.ok || res.type === 'opaque') {
        await cache.put(request, res.clone());
        recortar(cache);
    }
    return res;
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    const mismoOrigen = url.origin === self.location.origin;

    if (request.mode === 'navigate' && mismoOrigen && !url.pathname.startsWith('/api/')) {
        event.respondWith(pagina(request));
        return;
    }
    const esAsset = mismoOrigen && (url.pathname.startsWith('/assets/') || /\.(png|svg|ico|webmanifest)$/.test(url.pathname) || url.pathname === '/manifest.json');
    const esFuente = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
    if (esAsset || esFuente) event.respondWith(estatico(request));
});

// La página envía lo que descargó antes de que este SW tomara control.
self.addEventListener('message', (event) => {
    const { tipo, urls } = event.data || {};
    if (tipo !== 'guardar' || !Array.isArray(urls)) return;
    event.waitUntil(caches.open(CACHE).then(async (cache) => {
        for (const u of urls.slice(0, 80)) {
            const url = new URL(u, self.location.origin);
            const permitido = (url.origin === self.location.origin && url.pathname.startsWith('/assets/'))
                || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
            if (!permitido || await cache.match(url.href)) continue;
            try {
                const res = await fetch(url.href);
                if (res.ok) await cache.put(url.href, res);
            } catch { /* sin red: se intentará en la próxima apertura */ }
        }
        await recortar(cache);
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow('/');
        })
    );
});
