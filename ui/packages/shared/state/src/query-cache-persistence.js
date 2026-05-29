import { dehydrate, hydrate } from "@tanstack/react-query";
const DEFAULT_QUERY_CACHE_DB_NAME = "aa-query-cache";
const DEFAULT_QUERY_CACHE_STORE_NAME = "query-cache";
const DEFAULT_QUERY_CACHE_KEY = "default";
class NoopQueryCachePersister {
    async read() {
        return null;
    }
    async write(_state) { }
    async clear() { }
}
class IndexedDbQueryCachePersister {
    dbName;
    storeName;
    entryKey;
    dbPromise = null;
    constructor(dbName = DEFAULT_QUERY_CACHE_DB_NAME, storeName = DEFAULT_QUERY_CACHE_STORE_NAME, entryKey = DEFAULT_QUERY_CACHE_KEY) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.entryKey = entryKey;
    }
    async read() {
        try {
            const db = await this.openDb();
            return await new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, "readonly");
                const request = transaction.objectStore(this.storeName).get(this.entryKey);
                request.onsuccess = () => resolve(request.result ?? null);
                request.onerror = () => reject(request.error ?? new Error("query_cache.persistence_read_failed"));
            });
        }
        catch {
            return null;
        }
    }
    async write(state) {
        try {
            const db = await this.openDb();
            await new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, "readwrite");
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error ?? new Error("query_cache.persistence_write_failed"));
                transaction.objectStore(this.storeName).put(state, this.entryKey);
            });
        }
        catch {
            // Query cache persistence is best-effort and must not break runtime reads.
        }
    }
    async clear() {
        try {
            const db = await this.openDb();
            await new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, "readwrite");
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error ?? new Error("query_cache.persistence_clear_failed"));
                transaction.objectStore(this.storeName).delete(this.entryKey);
            });
        }
        catch {
            // Ignore cleanup failures.
        }
    }
    openDb() {
        if (typeof indexedDB === "undefined") {
            return Promise.reject(new Error("query_cache.indexeddb_unavailable"));
        }
        if (this.dbPromise != null) {
            return this.dbPromise;
        }
        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error ?? new Error("query_cache.indexeddb_open_failed"));
        });
        return this.dbPromise;
    }
}
class MemoryQueryCachePersister {
    state;
    constructor(initialState = null) {
        this.state = initialState;
    }
    async read() {
        return this.state;
    }
    async write(state) {
        this.state = state;
    }
    async clear() {
        this.state = null;
    }
}
export function createIndexedDbQueryCachePersister() {
    return typeof indexedDB === "undefined" ? new NoopQueryCachePersister() : new IndexedDbQueryCachePersister();
}
export function createMemoryQueryCachePersister(initialState = null) {
    return new MemoryQueryCachePersister(initialState);
}
export async function persistQueryClientSnapshot(queryClient, persister = createIndexedDbQueryCachePersister()) {
    await persister.write(dehydrate(queryClient, {
        shouldDehydrateQuery: (query) => shouldPersistQueryKey(query.queryKey),
    }));
}
export async function restorePersistedQueryClient(queryClient, persister = createIndexedDbQueryCachePersister()) {
    try {
        const persistedState = await persister.read();
        if (persistedState == null) {
            return false;
        }
        hydrate(queryClient, persistedState);
        return true;
    }
    catch {
        await persister.clear();
        return false;
    }
}
export function startPersistingQueryClient(queryClient, options = {}) {
    const persister = options.persister ?? createIndexedDbQueryCachePersister();
    const debounceMs = options.debounceMs ?? 100;
    let timeoutId = null;
    let disposed = false;
    let writeChain = Promise.resolve();
    const flush = () => {
        if (disposed) {
            return;
        }
        const snapshot = dehydrate(queryClient, {
            shouldDehydrateQuery: (query) => shouldPersistQueryKey(query.queryKey),
        });
        writeChain = writeChain
            .then(() => persister.write(snapshot))
            .catch(() => undefined);
    };
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
        if (timeoutId != null) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(flush, debounceMs);
    });
    return () => {
        disposed = true;
        if (timeoutId != null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        unsubscribe();
    };
}
function shouldPersistQueryKey(queryKey) {
    const prefix = String(queryKey[0] ?? "");
    return new Set([
        "dashboard",
        "tasks",
        "approvals",
        "workflows",
        "agents",
        "analytics",
        "queues",
        "incidents",
        "feature-flags",
        "domain-configs",
    ]).has(prefix);
}
