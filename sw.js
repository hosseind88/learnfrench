// FrançaisFacile • Service Worker (PWA Offline & Cache Engine)
const CACHE_NAME = 'francais-facile-v21';

const LOCAL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './storage.js',
  './app.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32x32.png',
  './favicon-16x16.png',
  './learning-scenes/scenes.json'
];

const OPTIONAL_ASSETS = [
  './secrets.js',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js'
];

function isBypassed(url, request) {
  if (request.method !== 'GET') return true;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
  if (url.hostname.includes('openrouter.ai')) return true;
  if (url.hostname.includes('pollinations.ai')) return true;
  if (url.hostname.includes('arvanstorage.ir')) return true;
  if (url.pathname.endsWith('.pdf') || url.pathname.includes('.pdf')) return true;
  return false;
}

async function precacheList(cache, urls) {
  await Promise.all(urls.map(async (url) => {
    try {
      await cache.add(url);
    } catch (err) {
      console.warn('Skip precache:', url, err);
    }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await precacheList(cache, LOCAL_ASSETS);
    await precacheList(cache, OPTIONAL_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

function refreshCache(cache, request) {
  fetch(request).then((response) => {
    if (response && response.ok && response.type !== 'opaque') {
      cache.put(request, response.clone());
    }
  }).catch(() => {});
}

async function handleFetch(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });

  if (cached) {
    if (self.navigator.onLine !== false) {
      refreshCache(cache, request);
    }
    return cached;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(request, { signal: controller.signal });
    if (response && response.ok && response.type !== 'opaque') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html') || await cache.match('./');
      if (fallback) return fallback;
    }
    return new Response('', { status: 503, statusText: 'Offline' });
  } finally {
    clearTimeout(timeoutId);
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (isBypassed(url, event.request)) return;
  event.respondWith(handleFetch(event.request));
});
