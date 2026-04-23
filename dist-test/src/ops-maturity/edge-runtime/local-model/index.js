export function selectEdgeLocalModel(models, modality) {
    return models
        .filter((item) => item.modalities.includes(modality))
        .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))[0] ?? null;
}
//# sourceMappingURL=index.js.map