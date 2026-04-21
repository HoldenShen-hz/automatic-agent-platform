import { z } from "zod";
export declare const DomainInteractionModeSchema: z.ZodEnum<["allow", "approval_required", "deny"]>;
export declare const DomainInteractionRuleSchema: z.ZodObject<{
    sourceDomainId: z.ZodString;
    targetDomainId: z.ZodString;
    mode: z.ZodEnum<["allow", "approval_required", "deny"]>;
    maxConcurrentWorkflows: z.ZodDefault<z.ZodNumber>;
    compensationRequired: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    mode: "allow" | "deny" | "approval_required";
    sourceDomainId: string;
    targetDomainId: string;
    maxConcurrentWorkflows: number;
    compensationRequired: boolean;
}, {
    mode: "allow" | "deny" | "approval_required";
    sourceDomainId: string;
    targetDomainId: string;
    maxConcurrentWorkflows?: number | undefined;
    compensationRequired?: boolean | undefined;
}>;
export type DomainInteractionMode = z.infer<typeof DomainInteractionModeSchema>;
export type DomainInteractionRule = z.infer<typeof DomainInteractionRuleSchema>;
export declare function isCrossDomainInteractionAllowed(rules: readonly DomainInteractionRule[], sourceDomainId: string, targetDomainId: string): boolean;
