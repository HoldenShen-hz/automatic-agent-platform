export class HarnessMemoryManager {
    namespaces = {
        run: new Map(),
        domain: new Map(),
        shared: new Map(),
    };
    write(namespace, scopeId, key, value) {
        const scoped = this.namespaces[namespace].get(scopeId) ?? new Map();
        scoped.set(key, value);
        this.namespaces[namespace].set(scopeId, scoped);
    }
    read(namespace, scopeId, key) {
        return this.namespaces[namespace].get(scopeId)?.get(key) ?? null;
    }
    list(namespace, scopeId) {
        const scoped = this.namespaces[namespace].get(scopeId);
        if (!scoped) {
            return [];
        }
        return [...scoped.entries()].map(([key, value]) => ({
            namespace,
            scopeId,
            key,
            value,
        }));
    }
}
//# sourceMappingURL=memory-manager.js.map