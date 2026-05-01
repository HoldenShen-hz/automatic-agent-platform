self.addEventListener("install", (event) => {
  // Issue #1932 P1: Pre-cache app shell and offline fallback page.
  // This ensures the app works offline even before any network requests are made.
  const appShell = ["/", "/offline"];
  event.waitUntil(
    caches.open("aa-ui-runtime-v1").then((cache) => {
      return cache.addAll(appShell).catch(() => {
        // Best effort - don't block installation if offline fallback pages aren't available
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  // Issue #1931 P1: activate was not cleaning old cache versions.
  // Clean up all old cache versions to prevent unbounded storage growth.
  const currentCacheName = "aa-ui-runtime-v1";
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== currentCacheName && cacheName.startsWith("aa-ui-"))
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }
  // R22-28 fix: Don't cache API requests - only cache static assets
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) {
    return; // Let API requests pass through without caching
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
  // R22-15 fix: Replay offline queue from IndexedDB
  event.waitUntil(replayOfflineQueue());
});

// Issue #1928 P0: Background sync handler was no-op, not implemented.
// This handler now replays offline queue from IndexedDB when connectivity returns.
async function replayOfflineQueue() {
  // Open IndexedDB and read pending offline mutations
  const db = await openDatabase();
  const tx = db.transaction("offline-queue", "readonly");
  const store = tx.objectStore("offline-queue");
  const mutations = await getAllFromStore(store);
  for (const mutation of mutations) {
    try {
      const response = await fetch(mutation.endpoint, {
        method: mutation.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutation.body),
      });
      if (response.ok) {
        // Delete successfully synced mutation
        const deleteTx = db.transaction("offline-queue", "readwrite");
        const deleteStore = deleteTx.objectStore("offline-queue");
        deleteStore.delete(mutation.id);
      }
    } catch {
      // Keep in queue for next sync
    }
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("aa-offline-db", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("offline-queue")) {
        db.createObjectStore("offline-queue", { keyPath: "id" });
      }
    };
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
