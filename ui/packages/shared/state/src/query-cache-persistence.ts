import { dehydrate, hydrate, type DehydratedState, type QueryClient } from "@tanstack/react-query";

const DEFAULT_QUERY_CACHE_DB_NAME = "aa-query-cache";
const DEFAULT_QUERY_CACHE_STORE_NAME = "query-cache";
const DEFAULT_QUERY_CACHE_KEY = "default";

export interface QueryCachePersister {
  read(): Promise<DehydratedState | null>;
  write(state: DehydratedState): Promise<void>;
  clear(): Promise<void>;
}

export interface PersistQueryClientOptions {
  readonly persister?: QueryCachePersister;
  readonly debounceMs?: number;
}

class NoopQueryCachePersister implements QueryCachePersister {
  public async read(): Promise<DehydratedState | null> {
    return null;
  }

  public async write(_state: DehydratedState): Promise<void> {}

  public async clear(): Promise<void> {}
}

class IndexedDbQueryCachePersister implements QueryCachePersister {
  private dbPromise: Promise<IDBDatabase> | null = null;

  public constructor(
    private readonly dbName = DEFAULT_QUERY_CACHE_DB_NAME,
    private readonly storeName = DEFAULT_QUERY_CACHE_STORE_NAME,
    private readonly entryKey = DEFAULT_QUERY_CACHE_KEY,
  ) {}

  public async read(): Promise<DehydratedState | null> {
    try {
      const db = await this.openDb();
      return await new Promise<DehydratedState | null>((resolve, reject) => {
        const transaction = db.transaction(this.storeName, "readonly");
        const request = transaction.objectStore(this.storeName).get(this.entryKey);
        request.onsuccess = () => resolve((request.result as DehydratedState | undefined) ?? null);
        request.onerror = () => reject(request.error ?? new Error("query_cache.persistence_read_failed"));
      });
    } catch {
      return null;
    }
  }

  public async write(state: DehydratedState): Promise<void> {
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(this.storeName, "readwrite");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("query_cache.persistence_write_failed"));
        transaction.objectStore(this.storeName).put(state, this.entryKey);
      });
    } catch {
      // Query cache persistence is best-effort and must not break runtime reads.
    }
  }

  public async clear(): Promise<void> {
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(this.storeName, "readwrite");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("query_cache.persistence_clear_failed"));
        transaction.objectStore(this.storeName).delete(this.entryKey);
      });
    } catch {
      // Ignore cleanup failures.
    }
  }

  private openDb(): Promise<IDBDatabase> {
    if (typeof indexedDB === "undefined") {
      return Promise.reject(new Error("query_cache.indexeddb_unavailable"));
    }

    if (this.dbPromise != null) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
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

class MemoryQueryCachePersister implements QueryCachePersister {
  private state: DehydratedState | null;

  public constructor(initialState: DehydratedState | null = null) {
    this.state = initialState;
  }

  public async read(): Promise<DehydratedState | null> {
    return this.state;
  }

  public async write(state: DehydratedState): Promise<void> {
    this.state = state;
  }

  public async clear(): Promise<void> {
    this.state = null;
  }
}

export function createIndexedDbQueryCachePersister(): QueryCachePersister {
  return typeof indexedDB === "undefined" ? new NoopQueryCachePersister() : new IndexedDbQueryCachePersister();
}

export function createMemoryQueryCachePersister(initialState: DehydratedState | null = null): QueryCachePersister {
  return new MemoryQueryCachePersister(initialState);
}

export async function persistQueryClientSnapshot(
  queryClient: QueryClient,
  persister: QueryCachePersister = createIndexedDbQueryCachePersister(),
): Promise<void> {
  await persister.write(dehydrate(queryClient, {
    shouldDehydrateQuery: (query) => shouldPersistQueryKey(query.queryKey),
  }));
}

export async function restorePersistedQueryClient(
  queryClient: QueryClient,
  persister: QueryCachePersister = createIndexedDbQueryCachePersister(),
): Promise<boolean> {
  try {
    const persistedState = await persister.read();
    if (persistedState == null) {
      return false;
    }
    hydrate(queryClient, persistedState);
    return true;
  } catch {
    await persister.clear();
    return false;
  }
}

export function startPersistingQueryClient(
  queryClient: QueryClient,
  options: PersistQueryClientOptions = {},
): () => void {
  const persister = options.persister ?? createIndexedDbQueryCachePersister();
  const debounceMs = options.debounceMs ?? 100;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let writeChain = Promise.resolve();

  const flush = (): void => {
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

function shouldPersistQueryKey(queryKey: readonly unknown[]): boolean {
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
