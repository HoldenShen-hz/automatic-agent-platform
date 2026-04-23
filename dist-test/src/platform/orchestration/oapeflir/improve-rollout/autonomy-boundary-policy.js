const AUTO_ALLOWED_TARGETS = new Set([
    "routing_policy",
    "planning_policy",
    "execution_policy",
    "memory_policy",
]);
export class AutonomyBoundaryPolicy {
    decide(target, learningObjects) {
        if (!AUTO_ALLOWED_TARGETS.has(target)) {
            return {
                allowed: false,
                reasonCode: "improvement.manual_approval_required",
            };
        }
        const allEvidenceBacked = learningObjects.every((item) => item.evidenceRefs.length > 0 && (item.promotionStatus === "validated" || item.promotionStatus === "promoted"));
        return {
            allowed: allEvidenceBacked,
            reasonCode: allEvidenceBacked ? "improvement.allowed" : "improvement.learning_object_not_validated",
        };
    }
}
//# sourceMappingURL=autonomy-boundary-policy.js.map