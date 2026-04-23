export class HitlOperatorConsoleService {
    routingRules;
    notifier;
    queue = new Map();
    constructor(routingRules, notifier) {
        this.routingRules = routingRules;
        this.notifier = notifier;
    }
    async dispatch(packet) {
        const channels = resolveChannels(packet, this.routingRules);
        const deliveryIds = [];
        let delivered = false;
        for (const channel of channels) {
            const result = await this.notifier({ channel, packet });
            delivered = delivered || result.delivered;
            if (result.deliveryId != null) {
                deliveryIds.push(result.deliveryId);
            }
        }
        const now = new Date().toISOString();
        this.queue.set(packet.approvalId, {
            queueItemId: `hitl_queue:${packet.approvalId}`,
            approvalId: packet.approvalId,
            taskId: packet.taskId,
            executionId: packet.executionId,
            tenantId: readTenantId(packet),
            title: packet.title,
            stageRef: packet.feedbackLink.stageRef,
            riskLevel: packet.riskLevel,
            explanationSummary: packet.explanation.summary,
            recommendedOptionId: packet.recommendedOptionId,
            deliveryChannels: channels,
            deliveryIds,
            status: "pending",
            acknowledgedBy: null,
            takeoverSessionId: null,
            createdAt: now,
            updatedAt: now,
        });
        return {
            channel: channels.join(","),
            delivered,
            deliveryId: deliveryIds[0] ?? null,
        };
    }
    listQueue(filters = {}) {
        return [...this.queue.values()].filter((item) => {
            if (filters.status != null && item.status !== filters.status) {
                return false;
            }
            if (filters.tenantId !== undefined && item.tenantId !== filters.tenantId) {
                return false;
            }
            if (filters.stageRef != null && item.stageRef !== filters.stageRef) {
                return false;
            }
            return true;
        });
    }
    acknowledge(approvalId, operatorId) {
        const item = this.requireQueueItem(approvalId);
        const updated = {
            ...item,
            status: "acknowledged",
            acknowledgedBy: operatorId,
            updatedAt: new Date().toISOString(),
        };
        this.queue.set(approvalId, updated);
        return updated;
    }
    resolve(approvalId, feedbackLink) {
        const item = this.requireQueueItem(approvalId);
        const updated = {
            ...item,
            status: "resolved",
            updatedAt: new Date().toISOString(),
            takeoverSessionId: feedbackLink.feedbackSignalId ?? item.takeoverSessionId,
        };
        this.queue.set(approvalId, updated);
        return updated;
    }
    attachTakeoverSession(approvalId, takeoverSessionId) {
        const item = this.requireQueueItem(approvalId);
        const updated = {
            ...item,
            takeoverSessionId,
            updatedAt: new Date().toISOString(),
        };
        this.queue.set(approvalId, updated);
        return updated;
    }
    requireQueueItem(approvalId) {
        const item = this.queue.get(approvalId);
        if (item == null) {
            throw new Error(`hitl_console.queue_item_not_found:${approvalId}`);
        }
        return item;
    }
}
function resolveChannels(packet, rules) {
    const tenantId = readTenantId(packet);
    const channels = new Set(["console"]);
    for (const rule of rules) {
        if (compareRisk(packet.riskLevel, rule.minRiskLevel) < 0) {
            continue;
        }
        if (rule.stages != null && !rule.stages.includes(packet.feedbackLink.stageRef)) {
            continue;
        }
        if (rule.tenantIds != null && tenantId != null && !rule.tenantIds.includes(tenantId)) {
            continue;
        }
        channels.add(rule.channel);
    }
    return [...channels];
}
function readTenantId(packet) {
    const tenantId = packet.explanation.contextSnapshot.tenantId;
    return typeof tenantId === "string" && tenantId.trim().length > 0 ? tenantId : null;
}
function compareRisk(left, right) {
    const weights = {
        low: 1,
        medium: 2,
        high: 3,
        critical: 4,
    };
    return weights[left] - weights[right];
}
//# sourceMappingURL=hitl-operator-console-service.js.map