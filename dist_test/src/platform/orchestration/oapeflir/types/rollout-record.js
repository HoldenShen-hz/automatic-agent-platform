import { z } from "zod";
export const RolloutLevelSchema = z.enum([
    "off",
    "suggest",
    "shadow",
    "canary_5",
    "partial_25",
    "partial_50",
    "partial_75",
    "stable",
]);
export const RolloutStatusSchema = z.enum([
    "draft",
    "pending_approval",
    "shadow",
    "canary_5",
    "partial_25",
    "partial_50",
    "partial_75",
    "stable",
    "rejected",
    "rolled_back",
    "paused",
]);
export const RolloutRecordSchema = z.object({
    recordId: z.string().min(1),
    candidateId: z.string().min(1),
    level: RolloutLevelSchema,
    previousLevel: RolloutLevelSchema.default("off"),
    strategyVersionId: z.string().nullable().default(null),
    status: RolloutStatusSchema.default("draft"),
    transitionedAt: z.number().int().nonnegative(),
    approvedBy: z.string().optional(),
    guardrailReasonCodes: z.array(z.string()).default([]),
    evidence: z.array(z.string()).default([]),
});
export function parseRolloutRecord(input) {
    return RolloutRecordSchema.parse(input);
}
//# sourceMappingURL=rollout-record.js.map