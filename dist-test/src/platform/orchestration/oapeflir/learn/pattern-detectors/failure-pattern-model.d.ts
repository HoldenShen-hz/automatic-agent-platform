import { z } from "zod";
/**
 * FailurePattern — a structured representation of a detected failure mode.
 * Used internally by pattern detectors and output by FailurePatternMiner.
 */
export declare const FailurePatternTypeSchema: z.ZodEnum<["llm_truncation", "schema_validation_loop", "tool_permission_denial", "model_hallucination", "generic_failure"]>;
export declare const FailurePatternSchema: z.ZodObject<{
    patternType: z.ZodEnum<["llm_truncation", "schema_validation_loop", "tool_permission_denial", "model_hallucination", "generic_failure"]>;
    taskId: z.ZodString;
    stepId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    summary: z.ZodString;
    evidenceRefs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sourceSignalIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    recommendation: z.ZodString;
    detectedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    summary: string;
    taskId: string;
    title: string;
    recommendation: string;
    evidenceRefs: string[];
    sourceSignalIds: string[];
    patternType: "llm_truncation" | "schema_validation_loop" | "tool_permission_denial" | "model_hallucination" | "generic_failure";
    detectedAt: number;
    stepId?: string | undefined;
}, {
    summary: string;
    taskId: string;
    title: string;
    recommendation: string;
    patternType: "llm_truncation" | "schema_validation_loop" | "tool_permission_denial" | "model_hallucination" | "generic_failure";
    detectedAt: number;
    stepId?: string | undefined;
    evidenceRefs?: string[] | undefined;
    sourceSignalIds?: string[] | undefined;
}>;
export type FailurePatternType = z.infer<typeof FailurePatternTypeSchema>;
export type FailurePattern = z.infer<typeof FailurePatternSchema>;
