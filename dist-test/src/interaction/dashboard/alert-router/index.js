const PRIORITY_ORDER = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
};
export function sortAttentionQueue(items) {
    return [...items].sort((left, right) => {
        const byPriority = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
        if (byPriority !== 0) {
            return byPriority;
        }
        return left.createdAt.localeCompare(right.createdAt);
    });
}
//# sourceMappingURL=index.js.map