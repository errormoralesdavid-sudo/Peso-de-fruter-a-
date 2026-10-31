/* ==========================================================
   SW.JS - SERVICE WORKER PARA SOPORTE OFFLINE Y CACHÉ SEGURO
   ========================================================== */

const CACHE_NAME = 'bascula-pos-cache-v2';

// Recursos estáticos esenciales para funcionar sin conexión
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js',
  'https://cdn-icons-png.flaticon.com/512/1046/1046857.png'
];

// 1. INSTALACIÓN: Guarda en caché los archivos principales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. ACTIVACIÓN: Elimina cachés antiguas cuando subes cambios a GitHub
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

// 3. INTERCEPTOR DE RED (FETCH): Protege APIs en vivo y acelera estáticos
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // REGLA DE SEGURIDAD: Nunca cachear Firestore ni APIs de tasas de cambio
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('dolarvzla.com') ||
    url.hostname.includes('dolarapi.com') ||
    event.request.method !== 'GET'
  ) {
    return; // Deja que pase directo a internet en tiempo real
  }

  // Estrategia: Buscar en Caché primero, si no está, ir a Red y guardar copia
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Solo cachear respuestas válidas de recursos estáticos o imágenes
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
          // Si no hay internet y pide navegar a la página, devolver index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
