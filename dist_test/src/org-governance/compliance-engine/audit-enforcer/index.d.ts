import { z } from "zod";
export declare const GovernanceAuditRecordSchema: z.ZodObject<{
    recordId: z.ZodString;
    action: z.ZodString;
    actorId: z.ZodString;
    orgNodeId: z.ZodString;
    allowed: z.ZodBoolean;
    reasonCodes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    occurredAt: string;
    action: string;
    actorId: string;
    allowed: boolean;
    orgNodeId: string;
    recordId: string;
    reasonCodes: string[];
}, {
    occurredAt: string;
    action: string;
    actorId: string;
    allowed: boolean;
    orgNodeId: string;
    recordId: string;
    reasonCodes?: string[] | undefined;
}>;
export type GovernanceAuditRecord = z.infer<typeof GovernanceAuditRecordSchema>;
export declare function buildGovernanceAuditRecord(input: GovernanceAuditRecord): GovernanceAuditRecord;
