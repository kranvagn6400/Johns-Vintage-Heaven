// عامل الخدمة: يحفظ ملفات الموقع ليفتح بسرعة وحتى مع ضعف الإنترنت
// غيّر رقم الإصدار CACHE عند أي تعديل على ملفات JS/CSS/HTML
const CACHE = 'jvh-v23';
const ASSETS = ['./', './index.html', './config.js', './css/app.css', './css/pixel.css', './js/util.js', './js/ui.js', './js/pixel.js', './js/api.js', './js/demo.js',
  './js/shop.js', './js/seller.js', './js/owner.js', './js/admin.js', './js/app.js', './js/picker.js',
  './fonts/kufi-arabic.woff2', './fonts/kufi-latin.woff2', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// ملفات الموقع فقط (نفس النطاق). طلبات Supabase والصور لا تمر من هنا.
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    const network = fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
    if (cached && /\.(woff2|png|svg)$/.test(url.pathname)) { network.catch(() => {}); return cached; }
    if (!cached) return network;
    const timeout = new Promise(r => setTimeout(() => r(cached), 4000));
    return Promise.race([network.catch(() => cached), timeout]);
  }));
});
