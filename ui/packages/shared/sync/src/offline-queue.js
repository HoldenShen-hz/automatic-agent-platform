const DEFAULT_MAX_CAPACITY = 100;
export class OfflineQueue {
    store;
    queue = [];
    stagedBeforeReady = [];
    ready = false;
    readyPromise;
    maxCapacity;
    onEvict;
    constructor(store = createMemoryOfflineMutationStore(), maxCapacityOrOptions = DEFAULT_MAX_CAPACITY) {
        this.store = store;
        if (typeof maxCapacityOrOptions === "number") {
            this.maxCapacity = maxCapacityOrOptions;
        }
        else {
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
    async whenReady() {
        await this.readyPromise;
    }
    async enqueue(mutation) {
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
    drain() {
        const drained = [...this.queue];
        this.queue.length = 0;
        this.stagedBeforeReady.length = 0;
        void this.persist();
        return drained;
    }
    peek() {
        return [...this.queue];
    }
    size() {
        return this.queue.length;
    }
    capacity() {
        return this.maxCapacity;
    }
    isFull() {
        return this.size() >= this.maxCapacity;
    }
    isEmpty() {
        return this.queue.length === 0;
    }
    async replace(mutations) {
        await this.readyPromise;
        this.queue.length = 0;
        this.queue.push(...mutations);
        this.trimToCapacity(this.queue);
        await this.persist();
    }
    trimToCapacity(target) {
        while (target.length > this.maxCapacity) {
            const evicted = target.shift();
            if (evicted != null) {
                this.onEvict?.(evicted);
            }
        }
    }
    async persist() {
        await this.readyPromise;
        await this.persistCurrentSnapshot();
    }
    async persistCurrentSnapshot() {
        await this.store.writeAll([...this.queue]);
    }
}
export function createPersistentOfflineQueue(store = createIndexedDbOfflineMutationStore()) {
    return new OfflineQueue(store);
}
export function createMemoryOfflineMutationStore(initial = []) {
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
export function createIndexedDbOfflineMutationStore(databaseName = "aa-ui-offline", storeName = "mutations") {
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
async function openDatabase(databaseName, storeName) {
    if (typeof indexedDB === "undefined") {
        return null;
    }
    return await new Promise((resolve, reject) => {
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
async function readSnapshot(db, storeName) {
    return await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get("queue");
        request.onsuccess = () => {
            resolve(Array.isArray(request.result) ? request.result : []);
        };
        request.onerror = () => reject(request.error);
    });
}
async function writeSnapshot(db, storeName, mutations) {
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        store.put([...mutations], "queue");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}
