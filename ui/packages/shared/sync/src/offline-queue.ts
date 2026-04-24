import type { OfflineMutation, OfflineMutationStore } from "./types";

export class OfflineQueue {
  private readonly queue: OfflineMutation[] = [];
  private readonly readyPromise: Promise<void>;

  public constructor(private readonly store: OfflineMutationStore = createMemoryOfflineMutationStore()) {
    this.readyPromise = this.store.readAll()
      .then((mutations) => {
        this.queue.push(...mutations);
      })
      .catch(() => undefined);
  }

  public async whenReady(): Promise<void> {
    await this.readyPromise;
  }

  public enqueue(mutation: OfflineMutation): void {
    this.queue.push(mutation);
    void this.persist();
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

  private async persist(): Promise<void> {
    await this.readyPromise;
    await this.store.writeAll([...this.queue]);
  }
}

export function createPersistentOfflineQueue(): OfflineQueue {
  return new OfflineQueue(createIndexedDbOfflineMutationStore());
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
