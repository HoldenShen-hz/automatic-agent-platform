import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

type ListenerMap = Record<string, (event: any) => void>;

function loadServiceWorker(overrides: {
  caches?: CacheStorage;
  fetch?: typeof fetch;
} = {}) {
  const listeners: ListenerMap = {};
  const script = readFileSync(
    resolve(process.cwd(), "ui/apps/web/public/aa-sw.js"),
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
    indexedDB: {
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

test("service worker install pre-caches app shell and offline fallback", async () => {
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
  listeners.install({
    waitUntil(promise: Promise<unknown>) {
      installPromise = promise;
    },
  });
  await installPromise;

  assert.deepEqual(cachedAssets.map((assets) => [...assets]), [["/", "/offline"]]);
});

test("service worker activate removes stale aa-ui caches and keeps current version", async () => {
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
  listeners.activate({
    waitUntil(promise: Promise<unknown>) {
      activatePromise = promise;
    },
  });
  await activatePromise;

  assert.deepEqual(deletedCaches, ["aa-ui-runtime-v0"]);
});

test("service worker fetch normalizes cache keys by stripping query strings", async () => {
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
  listeners.fetch({
    request: new Request("https://example.com/assets/app.js?v=123", { method: "GET" }),
    respondWith(promise: Promise<Response>) {
      responsePromise = promise;
    },
  });
  await responsePromise;

  assert.deepEqual(matchedKeys, ["https://example.com/assets/app.js"]);
  assert.deepEqual(storedKeys, ["https://example.com/assets/app.js"]);
});
