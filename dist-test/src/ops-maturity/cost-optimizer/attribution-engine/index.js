export function aggregateCostAttribution(entries) {
    return entries.reduce((acc, item) => {
        acc[item.subjectId] = Number(((acc[item.subjectId] ?? 0) + item.amountUsd).toFixed(4));
        return acc;
    }, {});
}
//# sourceMappingURL=index.js.map