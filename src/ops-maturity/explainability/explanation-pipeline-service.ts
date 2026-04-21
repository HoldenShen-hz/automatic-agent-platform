import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { buildCausalChainSummary, type CausalLink } from "./causal-chain-builder/index.js";
import { collectExplanationEvidenceIds, type ExplanationEvidence } from "./evidence-collector/index.js";
import { putExplanationCacheEntry, type ExplanationCacheEntry } from "./explanation-cache/index.js";
import { renderStageExplanation } from "./explanation-renderer/index.js";

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

function explanationCacheKey(taskId: string, stage: string, depth: ExplanationDepth): string {
  return `${taskId}:${stage}:${depth}`;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export class ExplanationPipelineService {
  private cache: Record<string, ExplanationCacheEntry> = {};

  public generate(request: ExplanationRequest, depth: ExplanationDepth = "L2"): ExplanationBundle {
    const allowedCategories = new Set(request.allowedEvidenceCategories ?? request.evidence.map((item) => item.category));
    const visibleEvidence = request.evidence.filter((item) => allowedCategories.has(item.category));
    const hiddenEvidence = request.evidence.filter((item) => !allowedCategories.has(item.category));
    const evidenceRefs = collectExplanationEvidenceIds(visibleEvidence);
    const redactedEvidenceRefs = collectExplanationEvidenceIds(hiddenEvidence);
    const rationale: StageRationale = {
      taskId: request.taskId,
      stage: request.stage,
      summary: request.summary,
      decisionFactors: uniqueStrings(request.decisionFactors),
      evidenceRefs,
      riskNotes: uniqueStrings(request.riskNotes),
      generatedAt: request.generatedAt ?? nowIso(),
    };
    const causalSummary = buildCausalChainSummary(request.causalLinks ?? []);
    const cacheKey = explanationCacheKey(request.taskId, request.stage, depth);
    const rendered = this.renderBundle(rationale, depth, causalSummary, redactedEvidenceRefs);

    this.cache = putExplanationCacheEntry(this.cache, {
      cacheKey,
      summary: rationale.summary,
    });

    return {
      explanationId: newId("explanation"),
      depth,
      rationale,
      rendered,
      causalSummary,
      redactedEvidenceRefs,
      cacheKey,
    };
  }

  public getCached(cacheKey: string): ExplanationCacheEntry | null {
    return this.cache[cacheKey] ?? null;
  }

  private renderBundle(
    rationale: StageRationale,
    depth: ExplanationDepth,
    causalSummary: readonly string[],
    redactedEvidenceRefs: readonly string[],
  ): string {
    const base = renderStageExplanation(rationale.stage, rationale.summary, rationale.evidenceRefs);
    if (depth === "L1") {
      return base;
    }

    const factors = rationale.decisionFactors.length > 0
      ? ` factors=${rationale.decisionFactors.join("; ")}`
      : "";
    const risks = rationale.riskNotes.length > 0
      ? ` risks=${rationale.riskNotes.join("; ")}`
      : "";

    if (depth === "L2") {
      return `${base}${factors}${risks}`;
    }

    const causal = causalSummary.length > 0
      ? ` causal=${causalSummary.join(" | ")}`
      : "";
    const redaction = redactedEvidenceRefs.length > 0
      ? ` redacted=${redactedEvidenceRefs.join(",")}`
      : "";
    return `${base}${factors}${risks}${causal}${redaction}`;
  }
}
