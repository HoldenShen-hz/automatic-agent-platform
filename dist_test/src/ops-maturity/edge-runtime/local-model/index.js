export function selectEdgeLocalModel(models, modality) {
    return models.find((item) => item.modalities.includes(modality)) ?? null;
}
//# sourceMappingURL=index.js.map