import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { it } from "vitest";

type ListenerMap = Record<string, (event: any) => void>;

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../../../../../");

function loadServiceWorker(overrides: {
  caches?: CacheStorage;
  fetch?: typeof fetch;
  indexedDB?: { open(name: string, version?: number): unknown };
} = {}) {
  const listeners: ListenerMap = {};
  const script = readFileSync(
    resolve(repoRoot, "ui/apps/web/public/aa-sw.js"),
    "utf8",
  );

  const context = vm.createContext({
    console,
    URL,
    Request,
    Response,
    Promise,
    setTimeout,
    clearTimeout,
    indexedDB: overrides.indexedDB ?? {
      open() {
        throw new Error("indexeddb not implemented for this test");
      },
    },
    caches: overrides.caches,
    fetch: overrides.fetch,
    self: {
      addEventListener(type: string, handler: (event: any) => void) {
        listeners[type] = handler;
      },
      skipWaiting() {
        return Promise.resolve();
      },
      clients: {
        claim() {
          return Promise.resolve();
        },
      },
    },
  });
  vm.runInContext(script, context);
  return listeners;
}

it("service worker install pre-caches app shell and offline fallback", async () => {
  const cachedAssets: string[][] = [];
  const listeners = loadServiceWorker({
    caches: {
      open: async () => ({
        addAll: async (assets: string[]) => {
          cachedAssets.push(assets);
        },
      }),
    } as unknown as CacheStorage,
  });

  let installPromise: Promise<unknown> | undefined;
  listeners.install?.({
    waitUntil(promise: Promise<unknown>) {
      installPromise = promise;
    },
  });
  await installPromise;

  assert.deepEqual(cachedAssets.map((assets) => [...assets]), [["/", "/offline"]]);
});

it("service worker activate removes stale aa-ui caches and keeps current version", async () => {
  const deletedCaches: string[] = [];
  const listeners = loadServiceWorker({
    caches: {
      keys: async () => ["aa-ui-runtime-v1", "aa-ui-runtime-v0", "other-cache"],
      delete: async (cacheName: string) => {
        deletedCaches.push(cacheName);
        return true;
      },
    } as unknown as CacheStorage,
  });

  let activatePromise: Promise<unknown> | undefined;
  listeners.activate?.({
    waitUntil(promise: Promise<unknown>) {
      activatePromise = promise;
    },
  });
  await activatePromise;

  assert.deepEqual(deletedCaches, ["aa-ui-runtime-v0"]);
});

it("service worker fetch normalizes cache keys by stripping query strings", async () => {
  const matchedKeys: string[] = [];
  const storedKeys: string[] = [];
  const listeners = loadServiceWorker({
    caches: {
      open: async () => ({
        match: async (request: Request) => {
          matchedKeys.push(request.url);
          return undefined;
        },
        put: async (request: Request) => {
          storedKeys.push(request.url);
        },
      }),
    } as unknown as CacheStorage,
    fetch: async () => new Response("ok", { status: 200 }),
  });

  let responsePromise: Promise<Response> | undefined;
  listeners.fetch?.({
    request: new Request("https://example.com/assets/app.js?v=123", { method: "GET" }),
    respondWith(promise: Promise<Response>) {
      responsePromise = promise;
    },
  });
  await responsePromise;

  assert.deepEqual(matchedKeys, ["https://example.com/assets/app.js"]);
  assert.deepEqual(storedKeys, ["https://example.com/assets/app.js"]);
});

it("service worker bypasses caching for API GET requests", () => {
  let respondWithCalled = false;
  let cacheOpened = false;
  const listeners = loadServiceWorker({
    caches: {
      open: async () => {
        cacheOpened = true;
        throw new Error("api requests should not open runtime cache");
      },
    } as unknown as CacheStorage,
    fetch: async () => {
      throw new Error("fetch should not be intercepted for API requests");
    },
  });

  listeners.fetch?.({
    request: new Request("https://example.com/api/v1/tasks", { method: "GET" }),
    respondWith() {
      respondWithCalled = true;
    },
  });

  assert.equal(respondWithCalled, false);
  assert.equal(cacheOpened, false);
});

it("service worker sync replays offline queue and deletes successfully synced mutations", async () => {
  const deletedIds: string[] = [];
  const fetchCalls: Array<{ endpoint: string; method: string; body: string | null }> = [];
  const db = {
    objectStoreNames: {
      contains(_name: string) {
        return true;
      },
    },
    createObjectStore(_name: string, _options: unknown) {
      return undefined;
    },
    transaction(_name: string, mode: string) {
      return {
        objectStore() {
          if (mode === "readonly") {
            return {
              getAll() {
                const request: {
                  error?: Error;
                  result?: unknown[];
                  onsuccess?: () => void;
                  onerror?: () => void;
                } = {};
                queueMicrotask(() => {
                  request.result = [
                    { id: "mutation-1", endpoint: "/api/v1/tasks", method: "POST", body: { ok: true } },
                    { id: "mutation-2", endpoint: "/api/v1/preferences", method: "PUT", body: { theme: "light" } },
                  ];
                  request.onsuccess?.();
                });
                return request;
              },
            };
          }
          return {
            delete(id: string) {
              deletedIds.push(id);
            },
          };
        },
      };
    },
  };

  const indexedDB = {
    open(_name: string, _version?: number) {
      const request: {
        error?: Error;
        result?: typeof db;
        onsuccess?: () => void;
        onerror?: () => void;
        onupgradeneeded?: (event: { target: { result: typeof db } }) => void;
      } = {};
      queueMicrotask(() => {
        request.result = db;
        request.onsuccess?.();
      });
      return request;
    },
  };

  const listeners = loadServiceWorker({
    indexedDB,
    fetch: async (input, init) => {
      const endpoint = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      fetchCalls.push({
        endpoint,
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : null,
      });
      return new Response("ok", { status: 200 });
    },
  });

  let syncPromise: Promise<unknown> | undefined;
  listeners.sync?.({
    tag: "aa-sync-offline",
    waitUntil(promise: Promise<unknown>) {
      syncPromise = promise;
    },
  });
  await syncPromise;

  assert.deepEqual(fetchCalls, [
    { endpoint: "/api/v1/tasks", method: "POST", body: JSON.stringify({ ok: true }) },
    { endpoint: "/api/v1/preferences", method: "PUT", body: JSON.stringify({ theme: "light" }) },
  ]);
  assert.deepEqual(deletedIds, ["mutation-1", "mutation-2"]);
});
