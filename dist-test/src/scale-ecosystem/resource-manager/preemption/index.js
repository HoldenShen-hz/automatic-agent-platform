export function choosePreemptionVictim(candidates) {
    return [...candidates].sort((left, right) => {
        if (left.priority !== right.priority) {
            return left.priority - right.priority;
        }
        return left.progressPercent - right.progressPercent;
    })[0] ?? null;
}
//# sourceMappingURL=index.js.map