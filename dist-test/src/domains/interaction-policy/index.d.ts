import { z } from "zod";
export declare const DomainInteractionModeSchema: z.ZodEnum<["allow", "approval_required", "deny"]>;
export declare const DomainInteractionRuleSchema: z.ZodObject<{
    sourceDomainId: z.ZodString;
    targetDomainId: z.ZodString;
    mode: z.ZodEnum<["allow", "approval_required", "deny"]>;
    maxConcurrentWorkflows: z.ZodDefault<z.ZodNumber>;
    compensationRequired: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    sourceDomainId: string;
    targetDomainId: string;
    mode: "allow" | "deny" | "approval_required";
    maxConcurrentWorkflows: number;
    compensationRequired: boolean;
}, {
    sourceDomainId: string;
    targetDomainId: string;
    mode: "allow" | "deny" | "approval_required";
    maxConcurrentWorkflows?: number | undefined;
    compensationRequired?: boolean | undefined;
}>;
export type DomainInteractionMode = z.infer<typeof DomainInteractionModeSchema>;
export type DomainInteractionRule = z.infer<typeof DomainInteractionRuleSchema>;
export interface DomainInteractionRequest {
    readonly sourceDomainId: string;
    readonly targetDomainId: string;
    readonly actorId: string;
    readonly workflowId: string;
    readonly concurrentWorkflowCount: number;
}
export interface DomainInteractionDecision {
    readonly allowed: boolean;
    readonly requiresApproval: boolean;
    readonly compensationRequired: boolean;
    readonly reasonCodes: readonly string[];
    readonly applicableRule: DomainInteractionRule | null;
}
export declare function isCrossDomainInteractionAllowed(rules: readonly DomainInteractionRule[], sourceDomainId: string, targetDomainId: string): boolean;
export declare class DomainInteractionPolicyService {
    evaluate(rules: readonly DomainInteractionRule[], request: DomainInteractionRequest): DomainInteractionDecision;
}
