export function mapEvidenceByType(items) {
    return items.reduce((acc, item) => {
        acc[item.evidenceType] = [...(acc[item.evidenceType] ?? []), item.evidenceId];
        return acc;
    }, {});
}
export function findMissingEvidenceTypes(items, requiredTypes) {
    const mapped = mapEvidenceByType(items);
    return requiredTypes.filter((type) => (mapped[type] ?? []).length === 0);
}
export class EvidenceMapperService {
    map(items) {
        return mapEvidenceByType(items);
    }
    summarizeCoverage(items, requiredTypes) {
        const mapped = mapEvidenceByType(items);
        const coveredTypes = requiredTypes.filter((type) => (mapped[type] ?? []).length > 0);
        const missingTypes = requiredTypes.filter((type) => (mapped[type] ?? []).length === 0);
        return {
            coverageRatio: requiredTypes.length === 0
                ? 1
                : Number((coveredTypes.length / requiredTypes.length).toFixed(2)),
            coveredTypes,
            missingTypes,
        };
    }
}
//# sourceMappingURL=index.js.map