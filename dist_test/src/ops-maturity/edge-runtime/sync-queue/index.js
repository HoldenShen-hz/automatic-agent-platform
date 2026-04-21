export function orderEdgeSyncQueue(items) {
    return [...items].sort((left, right) => right.priority - left.priority);
}
//# sourceMappingURL=index.js.map