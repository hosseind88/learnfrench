// FrançaisFacile • Service Worker (PWA Offline & Cache Engine)
const CACHE_NAME = 'francais-facile-v23';

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

function isImageRequest(request) {
  if (request.destination === 'image') return true;
  try {
    return /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(new URL(request.url).pathname);
  } catch (err) {
    return false;
  }
}

function isScriptRequest(request) {
  if (request.destination === 'script') return true;
  try {
    return /\.js$/i.test(new URL(request.url).pathname);
  } catch (err) {
    return false;
  }
}

function emptyScript() {
  return new Response('/* offline optional script */\n', {
    status: 200,
    headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
  });
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

function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
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

async function handleFetch(request) {
  const url = new URL(request.url);
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });

  if (cached) return cached;

  const timeoutMs = isImageRequest(request) ? 20000 : 2000;

  try {
    const response = await fetchWithTimeout(request, timeoutMs);
    if (response && response.ok && response.type !== 'opaque') {
      cache.put(request, response.clone());
    }
    if (response) return response;
  } catch (err) {
    /* network missing or timed out */
  }

  if (request.mode === 'navigate') {
    const fallback = await cache.match('./index.html') || await cache.match('./');
    if (fallback) return fallback;
  }

  if (isScriptRequest(request) || url.pathname.endsWith('/secrets.js')) {
    return emptyScript();
  }

  return new Response('', { status: 503, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (isBypassed(url, event.request)) return;
  event.respondWith(handleFetch(event.request));
});
