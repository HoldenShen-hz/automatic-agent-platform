export function inheritPolicyLayers(layers) {
    return layers.reduce((merged, layer) => mergePolicyRules(merged, layer.rules), {});
}
function mergePolicyRules(base, incoming) {
    const merged = { ...base };
    for (const [key, value] of Object.entries(incoming)) {
        const existing = merged[key];
        if (typeof existing === "boolean" && typeof value === "boolean") {
            merged[key] = existing || value;
            continue;
        }
        if (typeof existing === "number" && typeof value === "number") {
            merged[key] = Math.max(existing, value);
            continue;
        }
        if (typeof existing === "string" && typeof value === "string" && existing.length > 0) {
            merged[key] = existing === "restricted" || value === "restricted" ? "restricted" : value;
            continue;
        }
        merged[key] = value;
    }
    return merged;
}
//# sourceMappingURL=index.js.map