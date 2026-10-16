// Guarda la app en el móvil para que abra rápido. Los datos siempre vienen de Supabase.
const VERSION = 'bs-v36';
const ARCHIVOS = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'vendor/supabase.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/logo.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Primero la red (para recibir mejoras), y si no hay conexión, lo guardado.
  // no-cache: pide siempre la versión nueva al servidor (si no ha cambiado, llega rápido)
  e.respondWith(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then((r) => {
    const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});

// Avisos al móvil (los manda el servicio "enviar-push" de Supabase)
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { titulo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Blackstars', {
    body: d.texto || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { enlace: d.enlace || '#/avisos' }
  }));
});
// Al tocar el aviso se abre la app en esa pantalla
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL('./' + (e.notification.data && e.notification.data.enlace || '#/avisos'), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    const w = ws.find((c) => c.url.startsWith(self.registration.scope));
    if (w) { w.navigate(url); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
