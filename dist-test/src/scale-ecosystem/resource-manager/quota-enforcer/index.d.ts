import { z } from "zod";
export declare const QuotaPolicySchema: z.ZodObject<{
    scopeId: z.ZodString;
    resourceType: z.ZodDefault<z.ZodString>;
    hardLimit: z.ZodNumber;
    softLimit: z.ZodOptional<z.ZodNumber>;
    burstLimit: z.ZodOptional<z.ZodNumber>;
    resetWindow: z.ZodDefault<z.ZodString>;
    currentUsage: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    scopeId: string;
    resourceType: string;
    hardLimit: number;
    resetWindow: string;
    currentUsage: number;
    softLimit?: number | undefined;
    burstLimit?: number | undefined;
}, {
    scopeId: string;
    hardLimit: number;
    currentUsage: number;
    resourceType?: string | undefined;
    softLimit?: number | undefined;
    burstLimit?: number | undefined;
    resetWindow?: string | undefined;
}>;
export type QuotaPolicy = z.input<typeof QuotaPolicySchema>;
export interface QuotaDecision {
    readonly exceeded: boolean;
    readonly warning: boolean;
    readonly usesBurst: boolean;
    readonly remainingUnits: number;
}
export declare function evaluateQuota(policy: QuotaPolicy, requestedUnits: number): QuotaDecision;
export declare function isQuotaExceeded(policy: QuotaPolicy, requestedUnits: number): boolean;
