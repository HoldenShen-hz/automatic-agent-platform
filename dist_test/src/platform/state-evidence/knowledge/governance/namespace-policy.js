export class NamespacePolicyStore {
    namespaces = new Map();
    register(namespace) {
        this.namespaces.set(namespace.path, namespace);
        return namespace;
    }
    get(path) {
        return this.namespaces.get(path) ?? null;
    }
    list() {
        return [...this.namespaces.values()];
    }
}
//# sourceMappingURL=namespace-policy.js.map