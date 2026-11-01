// Answers page loads from cache and refreshes that copy in the background,
// so repeat visits cost no round trip. Only the app shell is cached here.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
	if (e.request.mode !== 'navigate') return;
	const net = fetch(e.request).then(async res => {
		if (res.ok) await (await caches.open('shell')).put('./', res.clone());
		return res;
	});
	e.waitUntil(net.catch(() => {}));
	e.respondWith(caches.match('./').then(hit => hit || net));
});
