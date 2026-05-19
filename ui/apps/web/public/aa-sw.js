const APP_SHELL_CACHE = "aa-ui-runtime-v2";
const OFFLINE_MUTATION_DB = "aa-ui-offline";
const OFFLINE_MUTATION_STORE = "mutations";
const PRECACHE_ASSETS = ["/", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    await cache.addAll(PRECACHE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith("aa-ui-runtime-") && cacheName !== APP_SHELL_CACHE)
        .map((cacheName) => caches.delete(cacheName)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || isApiRequest(event.request.url)) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    const cacheKey = normalizeCacheRequest(event.request);
    const cached = await cache.match(cacheKey);
    if (cached != null) {
      return cached;
    }
    try {
      const response = await fetchWithTimeout(event.request, 8000);
      if (response.ok) {
        await cache.put(cacheKey, response.clone());
      }
      return response;
    } catch {
      const offlineFallback = await cache.match("/offline");
      if (offlineFallback != null) {
        return offlineFallback;
      }
      return new Response("Offline", {
        status: 503,
        headers: {
          "content-type": "text/plain; charset=utf-8",
        },
      });
    }
  })());
});

self.addEventListener("sync", (event) => {
  if (event.tag !== "aa-sync-offline") {
    return;
  }
  event.waitUntil(replayOfflineMutations());
});

function isApiRequest(urlString) {
  const url = new URL(urlString);
  return url.pathname.startsWith("/api/");
}

function normalizeCacheRequest(request) {
  const url = new URL(request.url);
  url.search = "";
  url.hash = "";
  return new Request(url.toString(), { method: "GET" });
}

async function fetchWithTimeout(request, timeoutMs) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = controller == null ? null : setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, controller == null ? undefined : { signal: controller.signal });
  } finally {
    if (timeout != null) {
      clearTimeout(timeout);
    }
  }
}

async function replayOfflineMutations() {
  const db = await openOfflineMutationDb();
  if (db == null) {
    return;
  }
  const mutations = await readOfflineMutations(db);
  for (const mutation of mutations) {
    const response = await fetch(mutation.endpoint, {
      method: mutation.method,
      headers: {
        "content-type": "application/json",
      },
      body: mutation.body == null ? null : JSON.stringify(mutation.body),
    });
    if (response.ok) {
      await deleteOfflineMutation(db, mutation.id);
    }
  }
}

async function openOfflineMutationDb() {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_MUTATION_DB, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(OFFLINE_MUTATION_STORE)) {
        db.createObjectStore(OFFLINE_MUTATION_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readOfflineMutations(db) {
  return await new Promise((resolve, reject) => {
    const request = db.transaction(OFFLINE_MUTATION_STORE, "readonly").objectStore(OFFLINE_MUTATION_STORE).getAll();
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => reject(request.error);
  });
}

async function deleteOfflineMutation(db, mutationId) {
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(OFFLINE_MUTATION_STORE, "readwrite");
    const store = transaction.objectStore(OFFLINE_MUTATION_STORE);
    store.delete(mutationId);
    if (typeof transaction.oncomplete === "undefined") {
      resolve();
      return;
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
