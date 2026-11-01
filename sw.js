/* ==========================================================
   SW.JS - SERVICE WORKER V2 (SOPORTE OFFLINE + MOTOR QR SUICHE 7B)
   ========================================================== */

const CACHE_NAME = 'bascula-pos-pro-cache-v4';

// Recursos estáticos esenciales (incluye Anime.js, Lodash, D3.js y Motor QR)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
  'https://cdn-icons-png.flaticon.com/512/1046/1046857.png'
];

// 1. INSTALACIÓN: Guarda en caché el núcleo de la Súper App
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. ACTIVACIÓN: Limpia versiones viejas (v1) automáticamente al actualizar en GitHub
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. INTERCEPTOR DE RED (FETCH): Protege Firestore y tasas BCV en vivo
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // REGLA DE SEGURIDAD FINANCIERA: Nunca cachear validaciones de pago ni tasas de cambio
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('dolarvzla.com') ||
    url.hostname.includes('dolarapi.com') ||
    event.request.method !== 'GET'
  ) {
    return; // Pasa directo a internet en tiempo real
  }

  // Estrategia Cache-First con actualización dinámica para imágenes de productos
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')
          ) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
