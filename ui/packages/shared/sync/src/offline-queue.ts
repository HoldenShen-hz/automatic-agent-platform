import type { OfflineMutation, OfflineMutationStore } from "./types";

/** Default maximum queue capacity per §5.5 */
const DEFAULT_MAX_CAPACITY = 1000;

export class OfflineQueue {
  private readonly queue: OfflineMutation[] = [];
  private readonly readyPromise: Promise<void>;
  private readonly maxCapacity: number;
  private readonly store: OfflineMutationStore;

  public constructor(
    store: OfflineMutationStore = createMemoryOfflineMutationStore(),
    maxCapacity = DEFAULT_MAX_CAPACITY,
  ) {
    this.store = store;
    this.maxCapacity = maxCapacity;
    this.readyPromise = this.store.readAll()
      .then((mutations) => {
        // Filter out mutations exceeding capacity on load
        this.queue.push(...mutations.slice(0, maxCapacity));
      })
      .catch(() => undefined);
  }

  public async whenReady(): Promise<void> {
    await this.readyPromise;
  }

  /**
   * Enqueues a mutation with capacity check per §5.5.
   * If queue is at capacity, oldest pending mutations are evicted.
   * P1 FIX: Wait for IndexedDB to load before adding mutation to prevent data loss.
   * Previously, enqueue could be called before the initial readAll completed,
   * causing persist() to overwrite unloaded data with an incomplete queue.
   */
  public async enqueue(mutation: OfflineMutation): Promise<void> {
    // P1 FIX: Wait for initial IndexedDB load before accepting mutations
    await this.readyPromise;

    // Evict oldest pending mutations if at capacity
    while (this.queue.length >= this.maxCapacity) {
      const evicted = this.queue.shift();
      if (evicted != null) {
        // Log eviction for debugging (in production this would go to telemetry)
        console.warn(`[OfflineQueue] Evicted oldest mutation due to capacity limit: ${evicted.id}`);
      }
    }
    this.queue.push(mutation);
    await this.persist();
  }

  public drain(): OfflineMutation[] {
    const drained = [...this.queue];
    this.queue.length = 0;
    void this.persist();
    return drained;
  }

  public peek(): readonly OfflineMutation[] {
    return [...this.queue];
  }

  public size(): number {
    return this.queue.length;
  }

  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  public isFull(): boolean {
    return this.queue.length >= this.maxCapacity;
  }

  public capacity(): number {
    return this.maxCapacity;
  }

  private async persist(): Promise<void> {
    await this.readyPromise;
    try {
      await this.store.writeAll([...this.queue]);
    } catch (error) {
      // P1 FIX: Persist failure should not be silently ignored.
      // Log error so operators can see it; mutation remains in memory but will be
      // lost on crash. A more robust fix would be to track persist status per mutation.
      console.error("[OfflineQueue] Persist failed, mutations may be lost on crash:", error);
      throw error;
    }
  }
}

export function createPersistentOfflineQueue(store: OfflineMutationStore = createIndexedDbOfflineMutationStore()): OfflineQueue {
  return new OfflineQueue(store);
}

export function createMemoryOfflineMutationStore(initial: readonly OfflineMutation[] = []): OfflineMutationStore {
  let snapshot = [...initial];
  return {
    async readAll() {
      return [...snapshot];
    },
    async writeAll(mutations) {
      snapshot = [...mutations];
    },
  };
}

export function createIndexedDbOfflineMutationStore(
  databaseName = "aa-ui-offline",
  storeName = "mutations",
): OfflineMutationStore {
  return {
    async readAll() {
      const db = await openDatabase(databaseName, storeName);
      if (db == null) {
        return [];
      }
      return readSnapshot(db, storeName);
    },
    async writeAll(mutations) {
      const db = await openDatabase(databaseName, storeName);
      if (db == null) {
        return;
      }
      await writeSnapshot(db, storeName, mutations);
    },
  };
}

async function openDatabase(databaseName: string, storeName: string): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readSnapshot(db: IDBDatabase, storeName: string): Promise<readonly OfflineMutation[]> {
  return await new Promise<readonly OfflineMutation[]>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get("queue");
    request.onsuccess = () => {
      resolve(Array.isArray(request.result) ? request.result as readonly OfflineMutation[] : []);
    };
    request.onerror = () => reject(request.error);
  });
}

async function writeSnapshot(db: IDBDatabase, storeName: string, mutations: readonly OfflineMutation[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    store.put([...mutations], "queue");
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
