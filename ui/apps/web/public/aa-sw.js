const CACHE_PREFIX = "aa-ui-runtime-";
const APP_SHELL_CACHE = `${CACHE_PREFIX}v3`;
const OFFLINE_MUTATION_DB = "aa-ui-offline";
const OFFLINE_MUTATION_STORE = "mutations";
const PRECACHE_ASSETS = ["/"];
const STATIC_CACHE_MAX_ENTRIES = 60;
const DOCUMENT_CACHE_TTL_MS = 5 * 60 * 1000;
const ASSET_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const OFFLINE_REPLAY_CONCURRENCY = 3;
const OFFLINE_RETRY_LIMIT = 5;
const REQUIRED_MUTATION_HEADERS = ["authorization", "x-csrf-token", "idempotency-key"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    await cache.addAll(PRECACHE_ASSETS);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith("aa-ui-") && cacheName !== APP_SHELL_CACHE)
        .map((cacheName) => caches.delete(cacheName)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || isApiRequest(event.request.url)) {
    return;
  }

  if (isDocumentRequest(event.request)) {
    event.respondWith(handleDocumentRequest(event.request));
    return;
  }

  event.respondWith(handleStaticRequest(event.request));
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

function isDocumentRequest(request) {
  return request.mode === "navigate" || (request.headers.get("accept") ?? "").includes("text/html");
}

async function handleDocumentRequest(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  try {
    const response = await fetchWithTimeout(request, 8000);
    if (response.ok) {
      await putCacheEntry(cache, request, response.clone());
    }
    return response;
  } catch (error) {
    console.error("aa-sw.document_fetch_failed", error);
    const cached = await cache.match(request);
    if (cached != null) {
      return cached;
    }
    const appShell = await cache.match("/");
    if (appShell != null) {
      return appShell;
    }
    return new Response("Offline", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }
}

async function handleStaticRequest(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached != null && isFresh(cached, ASSET_CACHE_TTL_MS)) {
    return cached;
  }

  try {
    const response = await fetchWithTimeout(request, 8000);
    if (response.ok) {
      await putCacheEntry(cache, request, response.clone());
    }
    return response;
  } catch (error) {
    console.error("aa-sw.asset_fetch_failed", error);
    if (cached != null) {
      return cached;
    }
    return new Response("Offline", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }
}

function isFresh(response, ttlMs) {
  const cachedAt = Number(response.headers.get("x-aa-sw-cached-at") ?? "");
  if (!Number.isFinite(cachedAt) || cachedAt <= 0) {
    return false;
  }
  return Date.now() - cachedAt <= ttlMs;
}

async function putCacheEntry(cache, request, response) {
  const stamped = stampCachedResponse(response);
  await cache.put(request, stamped);
  await trimCache(cache, STATIC_CACHE_MAX_ENTRIES);
}

function stampCachedResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("x-aa-sw-cached-at", String(Date.now()));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) {
    return;
  }
  const staleKeys = keys.slice(0, keys.length - maxEntries);
  await Promise.all(staleKeys.map((key) => cache.delete(key)));
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

  const now = Date.now();
  const dueMutations = (await readOfflineMutations(db)).filter((mutation) => (mutation.nextAttemptAt ?? 0) <= now);
  for (let index = 0; index < dueMutations.length; index += OFFLINE_REPLAY_CONCURRENCY) {
    const batch = dueMutations.slice(index, index + OFFLINE_REPLAY_CONCURRENCY);
    await Promise.allSettled(batch.map((mutation) => replayOfflineMutation(db, mutation, now)));
  }
}

async function replayOfflineMutation(db, mutation, now) {
  const method = typeof mutation.method === "string" ? mutation.method.toUpperCase() : "POST";
  const headers = new Headers(mutation.headers ?? {});

  if (mutation.body != null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (requiresProtectedReplay(method, mutation.endpoint) && !hasRequiredHeaders(headers)) {
    console.error("aa-sw.offline_replay_missing_headers", mutation.id);
    await deleteOfflineMutation(db, mutation.id);
    return;
  }

  try {
    const response = await fetch(mutation.endpoint, {
      method,
      headers,
      body: mutation.body == null ? null : JSON.stringify(mutation.body),
    });
    if (response.ok) {
      await deleteOfflineMutation(db, mutation.id);
      return;
    }
    if (isPermanentReplayFailure(response.status)) {
      console.error("aa-sw.offline_replay_dropped", mutation.id, response.status);
      await deleteOfflineMutation(db, mutation.id);
      return;
    }
    await scheduleOfflineMutationRetry(db, mutation, now, response.status);
  } catch (error) {
    console.error("aa-sw.offline_replay_failed", mutation.id, error);
    await scheduleOfflineMutationRetry(db, mutation, now, null);
  }
}

function requiresProtectedReplay(method, endpoint) {
  if (method === "GET" || method === "HEAD") {
    return false;
  }
  return typeof endpoint === "string" && endpoint.startsWith("/api/");
}

function hasRequiredHeaders(headers) {
  return REQUIRED_MUTATION_HEADERS.every((name) => {
    const value = headers.get(name);
    return value != null && value.trim().length > 0;
  });
}

function isPermanentReplayFailure(status) {
  return status === 400
    || status === 401
    || status === 403
    || status === 404
    || status === 409
    || status === 410
    || status === 422;
}

async function scheduleOfflineMutationRetry(db, mutation, now, status) {
  const attemptCount = Number(mutation.attemptCount ?? 0) + 1;
  if (attemptCount > OFFLINE_RETRY_LIMIT) {
    await deleteOfflineMutation(db, mutation.id);
    return;
  }

  const backoffMs = Math.min(30 * 60 * 1000, 1000 * (2 ** attemptCount));
  await putOfflineMutation(db, {
    ...mutation,
    attemptCount,
    lastFailureStatus: status,
    nextAttemptAt: now + backoffMs,
  });
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

async function putOfflineMutation(db, mutation) {
  const transaction = db.transaction(OFFLINE_MUTATION_STORE, "readwrite");
  transaction.objectStore(OFFLINE_MUTATION_STORE).put(mutation);
  await awaitTransaction(transaction);
}

async function deleteOfflineMutation(db, mutationId) {
  const transaction = db.transaction(OFFLINE_MUTATION_STORE, "readwrite");
  transaction.objectStore(OFFLINE_MUTATION_STORE).delete(mutationId);
  await awaitTransaction(transaction);
}

async function awaitTransaction(transaction) {
  await new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
