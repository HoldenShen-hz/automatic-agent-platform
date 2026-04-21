export function resolveRequiredSlots(entities, requiredEntityTypes) {
    const resolved = {};
    for (const entity of entities) {
        if (!(entity.entityType in resolved)) {
            resolved[entity.entityType] = entity.normalized;
        }
    }
    return {
        missing: requiredEntityTypes.filter((item) => !(item in resolved)),
        resolved,
    };
}
//# sourceMappingURL=index.js.map