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

export type TransferItem = z.infer<typeof TransferItemSchema>;

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

export type AgentRetirementPlan = z.infer<typeof AgentRetirementPlanSchema>;

/**
 * Agent retirement record - tracks the full retirement process.
 */
export interface AgentRetirementRecord {
  readonly retiringAgentId: string;
  readonly successorAgentId: string | null;
  readonly transferItems: readonly TransferItem[];
  readonly gracePeriodDays: number;
  readonly notificationTargets: readonly string[];
  readonly initiatedAt: string;
  readonly scheduledRevokeAt: string;
  readonly completedAt: string | null;
  readonly status: "initiated" | "in_grace_period" | "completed" | "cancelled";
}

/**
 * R27-14 FIX: ISO string comparison must be timezone-aware.
 * plan.revokeAt may be in any timezone, so we parse both as Dates for proper comparison.
 */
export function canRetireAgent(plan: AgentRetirementPlan, nowIso: string): boolean {
  const revokeAtDate = new Date(plan.revokeAt);
  const nowDate = new Date(nowIso);
  return revokeAtDate.getTime() <= nowDate.getTime();
}

/**
 * Creates an AgentRetirementRecord from a plan.
 */
export function createRetirementRecord(
  plan: AgentRetirementPlan,
  initiatedAt: string,
): AgentRetirementRecord {
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
export function isGracePeriodExpired(record: AgentRetirementRecord, nowIso: string): boolean {
  const graceEndDate = new Date(record.initiatedAt);
  graceEndDate.setDate(graceEndDate.getDate() + record.gracePeriodDays);
  return nowIso >= graceEndDate.toISOString();
}
