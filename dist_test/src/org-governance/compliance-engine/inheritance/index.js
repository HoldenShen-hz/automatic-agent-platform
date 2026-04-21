export function inheritPolicyLayers(layers) {
    return layers.reduce((merged, layer) => ({
        ...merged,
        ...layer.rules,
    }), {});
}
//# sourceMappingURL=index.js.map