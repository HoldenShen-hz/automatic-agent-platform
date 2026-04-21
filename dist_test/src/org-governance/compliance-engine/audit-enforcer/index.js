import { z } from "zod";
export const GovernanceAuditRecordSchema = z.object({
    recordId: z.string().min(1),
    action: z.string().min(1),
    actorId: z.string().min(1),
    orgNodeId: z.string().min(1),
    allowed: z.boolean(),
    reasonCodes: z.array(z.string()).default([]),
    occurredAt: z.string().min(1),
});
export function buildGovernanceAuditRecord(input) {
    return GovernanceAuditRecordSchema.parse(input);
}
//# sourceMappingURL=index.js.map