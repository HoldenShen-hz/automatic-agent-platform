export function collectExplanationEvidenceIds(items) {
    return items.map((item) => item.evidenceId);
}
export function collectExplanationEvidence(items) {
    return {
        evidenceIds: collectExplanationEvidenceIds(items),
        groupedByCategory: items.reduce((acc, item) => {
            acc[item.category] = [...(acc[item.category] ?? []), item];
            return acc;
        }, {}),
    };
}
//# sourceMappingURL=index.js.map