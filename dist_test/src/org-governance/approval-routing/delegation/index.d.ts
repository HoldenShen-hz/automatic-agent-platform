import { z } from "zod";
export declare const ApprovalDelegationSchema: z.ZodObject<{
    delegationId: z.ZodString;
    approverId: z.ZodString;
    delegateApproverId: z.ZodString;
    scopeNodeIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    startsAt: z.ZodString;
    expiresAt: z.ZodString;
    active: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    active: boolean;
    expiresAt: string;
    delegationId: string;
    approverId: string;
    delegateApproverId: string;
    scopeNodeIds: string[];
    startsAt: string;
}, {
    expiresAt: string;
    delegationId: string;
    approverId: string;
    delegateApproverId: string;
    startsAt: string;
    active?: boolean | undefined;
    scopeNodeIds?: string[] | undefined;
}>;
export type ApprovalDelegation = z.infer<typeof ApprovalDelegationSchema>;
export declare function resolveDelegatedApprover(delegations: readonly ApprovalDelegation[], approverId: string, orgNodeId: string, nowIso: string): string;
