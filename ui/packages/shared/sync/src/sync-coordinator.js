import { ConflictResolver } from "./conflict-resolver.js";
import { createPersistentOfflineQueue } from "./offline-queue.js";
export class SyncCoordinator {
    queue;
    resolver;
    dispatcher;
    constructor(queue = createPersistentOfflineQueue(), resolver = new ConflictResolver(), dispatcher = new FetchSyncMutationDispatcher()) {
        this.queue = queue;
        this.resolver = resolver;
        this.dispatcher = dispatcher;
    }
    queueMutation(mutation) {
        return this.queue.enqueue(mutation);
    }
    async queueMutations(mutations) {
        await Promise.all(mutations.map(async (mutation) => {
            await this.queue.enqueue(mutation);
        }));
    }
    hasPending() {
        return !this.queue.isEmpty();
    }
    pendingCount() {
        return this.queue.size();
    }
    peekPending() {
        return this.queue.peek();
    }
    async flush(flushedAt = new Date().toISOString()) {
        const mutations = this.queue.peek();
        const succeeded = [];
        const failed = [];
        const conflicts = [];
        const retained = [];
        for (const mutation of mutations) {
            try {
                const response = await this.send(mutation);
                if (isConflictResponse(response)) {
                    const conflictedMutation = {
                        ...mutation,
                        status: "conflict",
                    };
                    conflicts.push({
                        mutation: conflictedMutation,
                        serverValue: response.serverValue,
                    });
                    retained.push(conflictedMutation);
                    continue;
                }
                succeeded.push(mutation);
            }
            catch {
                const retryableMutation = {
                    ...mutation,
                    retryCount: (mutation.retryCount ?? 0) + 1,
                    status: "pending",
                };
                failed.push(retryableMutation);
                retained.push(retryableMutation);
            }
        }
        await this.queue.replace(retained);
        return {
            succeeded,
            failed,
            conflicts,
            mutations: succeeded,
            flushedAt,
        };
    }
    resolveConflict(serverValue, localValue, strategy = "server_wins") {
        return this.resolver.resolve(serverValue, localValue, strategy);
    }
    async send(mutation) {
        if (typeof this.dispatcher.dispatch === "function") {
            return await this.dispatcher.dispatch(mutation);
        }
        if (typeof this.dispatcher.request === "function") {
            return await this.dispatcher.request(mutation);
        }
        throw new TypeError("sync.dispatcher_missing");
    }
}
export class FetchSyncMutationDispatcher {
    fetchImplementation;
    constructor(fetchImplementation = globalThis.fetch.bind(globalThis)) {
        this.fetchImplementation = fetchImplementation;
    }
    async dispatch(mutation) {
        const response = await this.fetchImplementation(mutation.endpoint, {
            method: mutation.method,
            headers: {
                "content-type": "application/json",
                ...(mutation.headers ?? {}),
            },
            ...(mutation.body == null ? {} : { body: JSON.stringify(mutation.body) }),
        });
        if (!response.ok) {
            throw new Error(`sync.flush_failed:${response.status}`);
        }
    }
}
function isConflictResponse(value) {
    return value != null
        && typeof value === "object"
        && value.conflict === true;
}
