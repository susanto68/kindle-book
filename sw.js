const CACHE_NAME = 'kindle-reader-v59-large-library';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/firebase-library.js',
  '/vendor/pdf.min.js',
  '/vendor/pdf.worker.min.js',
  '/vendor/page-flip.browser.min.js',
  '/vendor/jszip.min.js',
  '/vendor/epub.min.js',
  '/books.json',
  '/books.quick.json',
  '/books.gutenberg.json',
  '/favicon.svg',
  '/profile-avatar.png',
  '/icons/library-icon-180.png',
  '/icons/library-icon-192.png',
  '/icons/library-icon-512.png',
  '/og-library.svg',
  '/hero-library.svg'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const networkFirstPaths = new Set([
    '/',
    '/index.html',
    '/books.json',
    '/books.gutenberg.json',
    '/app.js',
    '/firebase-library.js',
    '/style.css',
    '/sw.js'
  ]);

  if (networkFirstPaths.has(requestUrl.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
