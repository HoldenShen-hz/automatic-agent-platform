import { z } from "zod";
export declare const ImprovementChangeScopeSchema: z.ZodEnum<["prompt", "policy", "model", "workflow", "tool_config"]>;
export declare const ImprovementCandidateStatusSchema: z.ZodEnum<["proposed", "evaluating", "approved", "shadow_running", "rejected", "rolled_back"]>;
export declare const ImprovementCandidateSchema: z.ZodObject<{
    candidateId: z.ZodString;
    taskId: z.ZodString;
    sourceSignalRefs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sourceLearningObjectIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    changeScope: z.ZodEnum<["prompt", "policy", "model", "workflow", "tool_config"]>;
    description: z.ZodString;
    expectedBenefit: z.ZodString;
    status: z.ZodEnum<["proposed", "evaluating", "approved", "shadow_running", "rejected", "rolled_back"]>;
    createdAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    createdAt: number;
    taskId: string;
    status: "approved" | "rejected" | "rolled_back" | "proposed" | "evaluating" | "shadow_running";
    description: string;
    candidateId: string;
    sourceSignalRefs: string[];
    sourceLearningObjectIds: string[];
    changeScope: "workflow" | "policy" | "prompt" | "model" | "tool_config";
    expectedBenefit: string;
}, {
    createdAt: number;
    taskId: string;
    status: "approved" | "rejected" | "rolled_back" | "proposed" | "evaluating" | "shadow_running";
    description: string;
    candidateId: string;
    changeScope: "workflow" | "policy" | "prompt" | "model" | "tool_config";
    expectedBenefit: string;
    sourceSignalRefs?: string[] | undefined;
    sourceLearningObjectIds?: string[] | undefined;
}>;
export type ImprovementChangeScope = z.infer<typeof ImprovementChangeScopeSchema>;
export type ImprovementCandidateStatus = z.infer<typeof ImprovementCandidateStatusSchema>;
export type ImprovementCandidate = z.infer<typeof ImprovementCandidateSchema>;
export declare function parseImprovementCandidate(input: unknown): ImprovementCandidate;
