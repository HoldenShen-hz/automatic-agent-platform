export function orderFairQueue(items) {
    return [...items].sort((left, right) => {
        const leftScore = left.priority * 10 + Math.min(9, Math.floor(left.ageMs / 60_000));
        const rightScore = right.priority * 10 + Math.min(9, Math.floor(right.ageMs / 60_000));
        return rightScore - leftScore;
    });
}
//# sourceMappingURL=index.js.map