export function analyzeFeedbackSignals(signals) {
    const bySeverity = signals.reduce((acc, item) => {
        acc[item.severity] = (acc[item.severity] ?? 0) + 1;
        return acc;
    }, {});
    const subjectCounts = signals.reduce((acc, item) => {
        const key = `task:${item.taskId}`;
        acc.set(key, (acc.get(key) ?? 0) + 1);
        return acc;
    }, new Map());
    const topSubjects = [...subjectCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([subject]) => subject);
    return {
        totalSignals: signals.length,
        bySeverity,
        topSubjects,
    };
}
//# sourceMappingURL=index.js.map