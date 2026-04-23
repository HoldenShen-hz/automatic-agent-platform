import { type CausalLink } from "./causal-chain-builder/index.js";
import { type ExplanationEvidence } from "./evidence-collector/index.js";
import { type ExplanationCacheEntry } from "./explanation-cache/index.js";
export type ExplanationDepth = "L1" | "L2" | "L3";
export interface ExplanationRequest {
    readonly taskId: string;
    readonly stage: string;
    readonly summary: string;
    readonly decisionFactors: readonly string[];
    readonly evidence: readonly ExplanationEvidence[];
    readonly riskNotes: readonly string[];
    readonly causalLinks?: readonly CausalLink[];
    readonly allowedEvidenceCategories?: readonly string[];
    readonly generatedAt?: string;
}
export interface StageRationale {
    readonly taskId: string;
    readonly stage: string;
    readonly summary: string;
    readonly decisionFactors: readonly string[];
    readonly evidenceRefs: readonly string[];
    readonly riskNotes: readonly string[];
    readonly generatedAt: string;
}
export interface ExplanationBundle {
    readonly explanationId: string;
    readonly depth: ExplanationDepth;
    readonly rationale: StageRationale;
    readonly rendered: string;
    readonly causalSummary: readonly string[];
    readonly redactedEvidenceRefs: readonly string[];
    readonly cacheKey: string;
}
export declare class ExplanationPipelineService {
    private cache;
    generate(request: ExplanationRequest, depth?: ExplanationDepth): ExplanationBundle;
    getCached(cacheKey: string): ExplanationCacheEntry | null;
    private renderBundle;
}
