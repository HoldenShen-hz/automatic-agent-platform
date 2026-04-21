import { z } from "zod";
/**
 * Transfer items for agent retirement as defined in architecture doc §61.5.
 */
export declare const TransferItemSchema: z.ZodEnum<["triggers", "subscriptions", "scheduled_tasks", "ownership"]>;
export type TransferItem = z.infer<typeof TransferItemSchema>;
/**
 * Agent retirement plan as defined in architecture doc §61.5.
 */
export declare const AgentRetirementPlanSchema: z.ZodObject<{
    agentId: z.ZodString;
    successorAgentId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    transferItems: z.ZodDefault<z.ZodArray<z.ZodEnum<["triggers", "subscriptions", "scheduled_tasks", "ownership"]>, "many">>;
    gracePeriodDays: z.ZodDefault<z.ZodNumber>;
    notificationTargets: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    revokeAt: z.ZodString;
    reason: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    reason: string;
    successorAgentId: string | null;
    transferItems: ("triggers" | "subscriptions" | "scheduled_tasks" | "ownership")[];
    gracePeriodDays: number;
    notificationTargets: string[];
    revokeAt: string;
}, {
    agentId: string;
    revokeAt: string;
    reason?: string | undefined;
    successorAgentId?: string | null | undefined;
    transferItems?: ("triggers" | "subscriptions" | "scheduled_tasks" | "ownership")[] | undefined;
    gracePeriodDays?: number | undefined;
    notificationTargets?: string[] | undefined;
}>;
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
export declare function canRetireAgent(plan: AgentRetirementPlan, nowIso: string): boolean;
/**
 * Creates an AgentRetirementRecord from a plan.
 */
export declare function createRetirementRecord(plan: AgentRetirementPlan, initiatedAt: string): AgentRetirementRecord;
/**
 * Checks if retirement grace period has expired.
 */
export declare function isGracePeriodExpired(record: AgentRetirementRecord, nowIso: string): boolean;
