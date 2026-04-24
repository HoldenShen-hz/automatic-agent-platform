self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open("aa-ui-runtime-v1");
    const cached = await cache.match(event.request);
    if (cached != null) {
      return cached;
    }
    const response = await fetch(event.request);
    if (response.ok) {
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});

self.addEventListener("sync", (event) => {
  if (event.tag !== "aa-sync-offline") {
    return;
  }
  event.waitUntil(Promise.resolve());
});
