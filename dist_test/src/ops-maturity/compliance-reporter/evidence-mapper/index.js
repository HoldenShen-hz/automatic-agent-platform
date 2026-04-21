export function mapEvidenceByType(items) {
    return items.reduce((acc, item) => {
        acc[item.evidenceType] = [...(acc[item.evidenceType] ?? []), item.evidenceId];
        return acc;
    }, {});
}
//# sourceMappingURL=index.js.map