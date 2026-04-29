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

// R22-15 fix: Background sync handler replays offline queue
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
