import type { OfflineMutation, OfflineMutationStore } from "./types.js";

const DEFAULT_MAX_CAPACITY = 100;

export interface OfflineQueueOptions {
  readonly maxCapacity?: number;
  readonly onEvict?: (mutation: OfflineMutation) => void;
}

export class OfflineQueue {
  private readonly queue: OfflineMutation[] = [];
  private readonly stagedBeforeReady: OfflineMutation[] = [];
  private ready = false;
  private readonly readyPromise: Promise<void>;
  private readonly maxCapacity: number;
  private readonly onEvict: ((mutation: OfflineMutation) => void) | undefined;

  public constructor(
    private readonly store: OfflineMutationStore = createMemoryOfflineMutationStore(),
    maxCapacityOrOptions: number | OfflineQueueOptions = DEFAULT_MAX_CAPACITY,
  ) {
    if (typeof maxCapacityOrOptions === "number") {
      this.maxCapacity = maxCapacityOrOptions;
    } else {
      this.maxCapacity = maxCapacityOrOptions.maxCapacity ?? DEFAULT_MAX_CAPACITY;
      this.onEvict = maxCapacityOrOptions.onEvict;
    }
    this.readyPromise = this.store.readAll()
      .catch(() => [])
      .then((mutations) => {
        this.queue.push(...mutations);
        this.trimToCapacity(this.queue);
        this.ready = true;
        if (this.stagedBeforeReady.length > 0) {
          this.queue.push(...this.stagedBeforeReady);
          this.stagedBeforeReady.length = 0;
          this.trimToCapacity(this.queue);
          return this.persistCurrentSnapshot();
        }
      });
  }

  public async whenReady(): Promise<void> {
    await this.readyPromise;
  }

  public async enqueue(mutation: OfflineMutation): Promise<void> {
    if (!this.ready) {
      this.stagedBeforeReady.push(mutation);
      this.trimToCapacity(this.stagedBeforeReady);
      await this.readyPromise;
      return;
    }
    this.queue.push(mutation);
    this.trimToCapacity(this.queue);
    await this.persist();
  }

  public drain(): OfflineMutation[] {
    const drained = [...this.queue];
    this.queue.length = 0;
    this.stagedBeforeReady.length = 0;
    void this.persist();
    return drained;
  }

  public peek(): readonly OfflineMutation[] {
    return [...this.queue];
  }

  public size(): number {
    return this.queue.length;
  }

  public capacity(): number {
    return this.maxCapacity;
  }

  public isFull(): boolean {
    return this.size() >= this.maxCapacity;
  }

  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  public async replace(mutations: readonly OfflineMutation[]): Promise<void> {
    await this.readyPromise;
    this.queue.length = 0;
    this.queue.push(...mutations);
    this.trimToCapacity(this.queue);
    await this.persist();
  }

  private trimToCapacity(target: OfflineMutation[]): void {
    while (target.length > this.maxCapacity) {
      const evicted = target.shift();
      if (evicted != null) {
        this.onEvict?.(evicted);
      }
    }
  }

  private async persist(): Promise<void> {
    await this.readyPromise;
    await this.persistCurrentSnapshot();
  }

  private async persistCurrentSnapshot(): Promise<void> {
    await this.store.writeAll([...this.queue]);
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
    async writeAll(mutations: readonly OfflineMutation[]) {
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
    async writeAll(mutations: readonly OfflineMutation[]) {
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
