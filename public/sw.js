/* ==========================================================================
   Service Worker OSIS TD2 — ditulis manual (tanpa next-pwa) supaya:
   - tidak bentrok dengan App Router Next 15
   - gampang dibaca & diubah
   Strategi:
   - navigasi HTML   : network-first, fallback cache, fallback /offline
   - /_next/static/* : cache-first (immutable, aman)
   - gambar & ikon   : stale-while-revalidate
   - API /auth       : network only (tidak pernah di-cache)
   ========================================================================== */

const VERSI = 'osis-td2-v1';
const CACHE_SHELL = `${VERSI}-shell`;
const CACHE_RUNTIME = `${VERSI}-runtime`;

const ASET_SHELL = ['/offline', '/logo.svg', '/icons/192.png', '/icons/512.png', '/icons/maskable.png', '/manifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      await Promise.allSettled(ASET_SHELL.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSI)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // jangan pernah cache endpoint sensitif
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth')) return;

  // 1) navigasi halaman -> network-first
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE_RUNTIME);
          cache.put(req, res.clone());
          return res;
        } catch {
          const cache = await caches.open(CACHE_RUNTIME);
          return (
            (await cache.match(req)) ||
            (await caches.match('/offline')) ||
            new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
          );
        }
      })(),
    );
    return;
  }

  // 2) aset build Next -> cache-first (immutable)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_RUNTIME);
        const ada = await cache.match(req);
        if (ada) return ada;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return new Response('', { status: 504 });
        }
      })(),
    );
    return;
  }

  // 3) gambar/ikon/font -> stale-while-revalidate
  if (/\.(png|jpg|jpeg|webp|gif|svg|ico|woff2?|ttf)$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_RUNTIME);
        const ada = await cache.match(req);
        const jaringan = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);
        return ada || (await jaringan) || new Response('', { status: 504 });
      })(),
    );
  }
});

/* ---------------- Web Push ---------------- */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'OSIS TD2', body: event.data ? event.data.text() : 'Ada kabar baru' };
  }

  const judul = data.title || 'OSIS SMK Tri Dharma 2 Bogor';
  const opsi = {
    body: data.body || '',
    icon: data.icon || '/icons/192.png',
    badge: '/icons/192.png',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || '/home' },
    vibrate: [60, 40, 60],
    actions: data.url && data.url.startsWith('/lapor')
      ? [{ action: 'buka', title: 'Baca balasan' }]
      : [],
  };

  event.waitUntil(self.registration.showNotification(judul, opsi));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/home';

  event.waitUntil(
    (async () => {
      const semua = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of semua) {
        if ('focus' in c) {
          c.navigate(target);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })(),
  );
});

/* jaga-jaga: message dari halaman (mis. skipWaiting saat ada versi baru) */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
