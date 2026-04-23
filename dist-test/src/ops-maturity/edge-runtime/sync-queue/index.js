export function orderEdgeSyncQueue(items) {
    return [...items].sort((left, right) => {
        if (right.priority !== left.priority) {
            return right.priority - left.priority;
        }
        return String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? ""));
    });
}
export function dedupeEdgeSyncQueue(items) {
    const latest = new Map();
    for (const item of items) {
        latest.set(item.envelopeId, item);
    }
    return orderEdgeSyncQueue([...latest.values()]);
}
//# sourceMappingURL=index.js.map