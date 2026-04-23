export class HitlInboxService {
    buildInbox(packets, feedbackLinks = [], now = new Date().toISOString()) {
        const feedbackByApprovalId = new Map(feedbackLinks.map((link) => [link.approvalId, link]));
        return packets
            .map((packet) => this.toInboxItem(packet, feedbackByApprovalId.get(packet.approvalId) ?? null, now))
            .sort((left, right) => {
            return compareStatus(left.status, right.status)
                || compareRisk(left.riskLevel, right.riskLevel)
                || compareNullableIso(left.deadlineAt, right.deadlineAt)
                || left.approvalId.localeCompare(right.approvalId);
        });
    }
    buildSummary(items) {
        return {
            total: items.length,
            pending: items.filter((item) => item.status === "pending").length,
            dueSoon: items.filter((item) => item.status === "due_soon").length,
            expired: items.filter((item) => item.status === "expired").length,
            decided: items.filter((item) => item.status === "decided").length,
            critical: items.filter((item) => item.riskLevel === "critical").length,
        };
    }
    toInboxItem(packet, feedbackLink, now) {
        return {
            itemId: `hitl_inbox:${packet.approvalId}`,
            approvalId: packet.approvalId,
            taskId: packet.taskId,
            executionId: packet.executionId,
            mode: packet.mode,
            title: packet.title,
            reason: packet.reason,
            riskLevel: packet.riskLevel,
            stageRef: packet.feedbackLink.stageRef,
            status: resolveStatus(packet.deadlineAt, feedbackLink, now),
            deadlineAt: packet.deadlineAt,
            timeoutPolicy: packet.timeoutPolicy,
            recommendedOptionId: packet.recommendedOptionId,
            availableActions: packet.options,
            notificationChannels: defaultNotificationChannels(packet.riskLevel, packet.mode),
            explanationSummary: packet.explanation.summary,
        };
    }
}
function resolveStatus(deadlineAt, feedbackLink, now) {
    if (feedbackLink?.feedbackSignalId != null || (feedbackLink != null && feedbackLink.decisionEffect !== "continue")) {
        return "decided";
    }
    if (deadlineAt == null) {
        return "pending";
    }
    if (deadlineAt <= now) {
        return "expired";
    }
    const remainingMs = Date.parse(deadlineAt) - Date.parse(now);
    if (Number.isFinite(remainingMs) && remainingMs <= 15 * 60 * 1000) {
        return "due_soon";
    }
    return "pending";
}
function defaultNotificationChannels(riskLevel, mode) {
    if (mode === "circuit_breaker_human") {
        return ["console", "slack", "mobile_push", "webhook"];
    }
    if (mode === "delegated_approval") {
        return ["console", "email", "slack"];
    }
    if (riskLevel === "critical") {
        return ["console", "slack", "mobile_push"];
    }
    if (riskLevel === "high") {
        return ["console", "slack"];
    }
    return ["console"];
}
function compareStatus(left, right) {
    const order = {
        expired: 0,
        due_soon: 1,
        pending: 2,
        decided: 3,
    };
    return order[left] - order[right];
}
function compareRisk(left, right) {
    const order = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
    };
    return order[left] - order[right];
}
function compareNullableIso(left, right) {
    if (left == null && right == null) {
        return 0;
    }
    if (left == null) {
        return 1;
    }
    if (right == null) {
        return -1;
    }
    return left.localeCompare(right);
}
//# sourceMappingURL=hitl-inbox-service.js.map