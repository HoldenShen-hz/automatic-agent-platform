export function resolveTriggerActionMode(requireConfirmation, riskLevel) {
    if (requireConfirmation) {
        return "suggest";
    }
    if (riskLevel === "critical") {
        return "silent_record";
    }
    return "auto_execute";
}
//# sourceMappingURL=index.js.map