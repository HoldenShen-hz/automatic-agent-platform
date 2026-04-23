import { z } from "zod";
/**
 * Transfer items for agent retirement as defined in architecture doc §61.5.
 */
export const TransferItemSchema = z.enum([
    "triggers",
    "subscriptions",
    "scheduled_tasks",
    "ownership",
]);
/**
 * Agent retirement plan as defined in architecture doc §61.5.
 */
export const AgentRetirementPlanSchema = z.object({
    agentId: z.string().min(1),
    successorAgentId: z.string().nullable().default(null),
    transferItems: z.array(TransferItemSchema).default([]),
    gracePeriodDays: z.number().int().nonnegative().default(30),
    notificationTargets: z.array(z.string()).default([]),
    revokeAt: z.string().min(1),
    reason: z.string().default(""),
});
export function canRetireAgent(plan, nowIso) {
    return plan.revokeAt <= nowIso;
}
/**
 * Creates an AgentRetirementRecord from a plan.
 */
export function createRetirementRecord(plan, initiatedAt) {
    return {
        retiringAgentId: plan.agentId,
        successorAgentId: plan.successorAgentId,
        transferItems: plan.transferItems,
        gracePeriodDays: plan.gracePeriodDays,
        notificationTargets: plan.notificationTargets,
        initiatedAt,
        scheduledRevokeAt: plan.revokeAt,
        completedAt: null,
        status: "initiated",
    };
}
/**
 * Checks if retirement grace period has expired.
 */
export function isGracePeriodExpired(record, nowIso) {
    const graceEndDate = new Date(record.initiatedAt);
    graceEndDate.setDate(graceEndDate.getDate() + record.gracePeriodDays);
    return nowIso >= graceEndDate.toISOString();
}
//# sourceMappingURL=index.js.map