export class ToolBundleRegistry {
    bundles = new Map();
    registerAll(bundles) {
        for (const bundle of bundles) {
            this.bundles.set(bundle.bundleId, bundle);
        }
    }
    get(bundleId) {
        return this.bundles.get(bundleId) ?? null;
    }
    list() {
        return [...this.bundles.values()];
    }
}
//# sourceMappingURL=tool-bundle-registry.js.map