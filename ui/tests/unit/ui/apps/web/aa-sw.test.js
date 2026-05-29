import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { it } from "vitest";
const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../../../../../");
function loadServiceWorker(overrides = {}) {
    const listeners = {};
    const script = readFileSync(resolve(repoRoot, "ui/apps/web/public/aa-sw.js"), "utf8");
    const context = vm.createContext({
        console,
        URL,
        Headers,
        Request,
        Response,
        AbortController,
        DOMException,
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
            addEventListener(type, handler) {
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
it("service worker install pre-caches the root app shell", async () => {
    const cachedAssets = [];
    const listeners = loadServiceWorker({
        caches: {
            open: async () => ({
                addAll: async (assets) => {
                    cachedAssets.push(assets);
                },
            }),
        },
    });
    let installPromise;
    listeners.install?.({
        waitUntil(promise) {
            installPromise = promise;
        },
    });
    await installPromise;
    assert.deepEqual(cachedAssets.map((assets) => [...assets]), [["/"]]);
});
it("service worker activate removes stale aa-ui caches and keeps current version", async () => {
    const deletedCaches = [];
    const listeners = loadServiceWorker({
        caches: {
            keys: async () => ["aa-ui-runtime-v2", "aa-ui-runtime-v1", "other-cache"],
            delete: async (cacheName) => {
                deletedCaches.push(cacheName);
                return true;
            },
        },
    });
    let activatePromise;
    listeners.activate?.({
        waitUntil(promise) {
            activatePromise = promise;
        },
    });
    await activatePromise;
    assert.deepEqual(deletedCaches, ["aa-ui-runtime-v2", "aa-ui-runtime-v1"]);
});
it("service worker fetch preserves query strings when caching assets", async () => {
    const matchedKeys = [];
    const storedKeys = [];
    const listeners = loadServiceWorker({
        caches: {
            open: async () => ({
                match: async (request) => {
                    matchedKeys.push(request.url);
                    return undefined;
                },
                put: async (request) => {
                    storedKeys.push(request.url);
                },
            }),
        },
        fetch: async () => new Response("ok", { status: 200 }),
    });
    let responsePromise;
    listeners.fetch?.({
        request: new Request("https://example.com/assets/app.js?v=123", { method: "GET" }),
        respondWith(promise) {
            responsePromise = promise;
        },
    });
    await responsePromise;
    assert.deepEqual(matchedKeys, ["https://example.com/assets/app.js?v=123"]);
    assert.deepEqual(storedKeys, ["https://example.com/assets/app.js?v=123"]);
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
        },
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
it("service worker falls back to the cached app shell for document navigations when network fetch fails", async () => {
    const listeners = loadServiceWorker({
        caches: {
            open: async () => ({
                match: async (request) => {
                    if (typeof request === "string" ? request === "/" : request.url.endsWith("/")) {
                        return new Response("cached-shell", { status: 200 });
                    }
                    return undefined;
                },
                put: async () => undefined,
            }),
        },
        fetch: async () => {
            throw new Error("network failed");
        },
    });
    let responsePromise;
    listeners.fetch?.({
        request: new Request("https://example.com/dashboard", {
            method: "GET",
            headers: { accept: "text/html" },
        }),
        respondWith(promise) {
            responsePromise = promise;
        },
    });
    const response = await responsePromise;
    assert.equal(await response?.text(), "cached-shell");
});
it("service worker sync replays offline queue and deletes successfully synced mutations", async () => {
    const deletedIds = [];
    const updatedMutations = [];
    const fetchCalls = [];
    function createTransaction(mode) {
        const transaction = {
            objectStore() {
                if (mode === "readonly") {
                    return {
                        getAll() {
                            const request = {};
                            queueMicrotask(() => {
                                request.result = [
                                    {
                                        id: "mutation-1",
                                        endpoint: "/api/v1/tasks",
                                        method: "POST",
                                        headers: {
                                            authorization: "Bearer token",
                                            "x-csrf-token": "csrf-token",
                                            "idempotency-key": "idem-1",
                                        },
                                        body: { ok: true },
                                    },
                                    {
                                        id: "mutation-2",
                                        endpoint: "/api/v1/preferences",
                                        method: "PUT",
                                        headers: {
                                            authorization: "Bearer token",
                                            "x-csrf-token": "csrf-token",
                                            "idempotency-key": "idem-2",
                                        },
                                        body: { theme: "light" },
                                    },
                                ];
                                request.onsuccess?.();
                            });
                            return request;
                        },
                    };
                }
                return {
                    delete(id) {
                        deletedIds.push(id);
                        queueMicrotask(() => transaction.oncomplete?.());
                    },
                    put(value) {
                        updatedMutations.push(value);
                        queueMicrotask(() => transaction.oncomplete?.());
                    },
                };
            },
        };
        return transaction;
    }
    const db = {
        objectStoreNames: {
            contains(_name) {
                return true;
            },
        },
        createObjectStore(_name, _options) {
            return undefined;
        },
        transaction(_name, mode) {
            return createTransaction(mode);
        },
    };
    const indexedDB = {
        open(_name, _version) {
            const request = {};
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
    let syncPromise;
    listeners.sync?.({
        tag: "aa-sync-offline",
        waitUntil(promise) {
            syncPromise = promise;
        },
    });
    await syncPromise;
    assert.deepEqual(fetchCalls, [
        { endpoint: "/api/v1/tasks", method: "POST", body: JSON.stringify({ ok: true }) },
        { endpoint: "/api/v1/preferences", method: "PUT", body: JSON.stringify({ theme: "light" }) },
    ]);
    assert.deepEqual(deletedIds, ["mutation-1", "mutation-2"]);
    assert.deepEqual(updatedMutations, []);
});
