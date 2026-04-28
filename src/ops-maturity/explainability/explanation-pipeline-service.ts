import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { buildCausalChainSummary, type CausalLink } from "./causal-chain-builder/index.js";
import { collectExplanationEvidenceIds, type ExplanationEvidence } from "./evidence-collector/index.js";
import { putExplanationCacheEntry, type ExplanationCacheEntry } from "./explanation-cache/index.js";
import { renderStageExplanation } from "./explanation-renderer/index.js";

export type ExplanationDepth = "L1" | "L2" | "L3";

export interface ExplanationRequest {
  readonly taskId: string;
  readonly stageId?: string;
  readonly stage?: string;
  readonly summary: string;
  readonly decision?: "accept" | "retry_same_plan" | "replan" | "escalate_to_human" | "downgrade_mode" | "abort";
  readonly decisionFactors: readonly string[];
  readonly evidence: readonly ExplanationEvidence[];
  readonly riskNotes: readonly string[];
  readonly causalLinks?: readonly CausalLink[];
  readonly allowedEvidenceCategories?: readonly string[];
  readonly generatedAt?: string;
}

export interface StageRationale {
  readonly rationaleId: string;
  readonly taskId: string;
  readonly stageId: string;
  readonly decision: ExplanationRequest["decision"];
  readonly summary: string;
  readonly decisionFactors: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly riskNotes: readonly string[];
  readonly alternatives?: readonly string[];
  readonly confidence?: number;
  readonly decisionInputRef?: string;
  readonly versionLockRef?: string;
  readonly visibilityLabels?: readonly string[];
  readonly renderedExplanation?: string;
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

function explanationCacheKey(taskId: string, stageId: string, depth: ExplanationDepth): string {
  const depthKey = depth === "L3" ? "audit" : depth;
  return `${taskId}:${stageId}:${depthKey}`;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export class ExplanationPipelineService {
  private cache: Record<string, ExplanationCacheEntry> = {};

  public generate(
    request: ExplanationRequest,
    depth: ExplanationDepth = "L2",
    options?: {
      readonly alternatives?: readonly string[];
      readonly confidence?: number;
      readonly decisionInputRef?: string;
      readonly versionLockRef?: string;
      readonly visibilityLabels?: readonly string[];
      readonly oapeflirProjection?: string;
    },
  ): ExplanationBundle {
    const stageId = request.stageId ?? request.stage ?? "unknown";
    const allowedCategories = new Set(request.allowedEvidenceCategories ?? request.evidence.map((item) => item.category));
    const visibleEvidence = request.evidence.filter((item) => allowedCategories.has(item.category));
    const hiddenEvidence = request.evidence.filter((item) => !allowedCategories.has(item.category));
    const evidenceRefs = collectExplanationEvidenceIds(visibleEvidence);
    const redactedEvidenceRefs = collectExplanationEvidenceIds(hiddenEvidence);
    const renderedExplanation = renderStageExplanation(stageId, request.summary, evidenceRefs, request.decision);
    const rationale: StageRationale = {
      rationaleId: newId("rationale"),
      taskId: request.taskId,
      stageId,
      decision: request.decision ?? "accept",
      summary: request.summary,
      decisionFactors: uniqueStrings(request.decisionFactors),
      evidenceRefs,
      riskNotes: uniqueStrings(request.riskNotes),
      alternatives: options?.alternatives,
      confidence: options?.confidence,
      decisionInputRef: options?.decisionInputRef,
      versionLockRef: options?.versionLockRef,
      visibilityLabels: options?.visibilityLabels,
      renderedExplanation,
      generatedAt: request.generatedAt ?? nowIso(),
    };
    const causalSummary = buildCausalChainSummary(request.causalLinks ?? []);
    const cacheKey = explanationCacheKey(request.taskId, stageId, depth);
    const rendered = this.renderBundle(rationale, depth, causalSummary, redactedEvidenceRefs);

    this.cache = putExplanationCacheEntry(this.cache, {
      cacheKey,
      summary: rationale.summary,
      ttlHours: depth === "L3" ? 0 : 24,
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
    const base = renderStageExplanation(rationale.stageId, rationale.summary, rationale.evidenceRefs);
    const decision = ` decision=${rationale.decision}`;
    if (depth === "L1") {
      return `${base}${decision}`;
    }

    const factors = rationale.decisionFactors.length > 0
      ? ` factors=${rationale.decisionFactors.join("; ")}`
      : "";
    const risks = rationale.riskNotes.length > 0
      ? ` risks=${rationale.riskNotes.join("; ")}`
      : "";

    if (depth === "L2") {
      return `${base}${decision}${factors}${risks}`;
    }

    const causal = causalSummary.length > 0
      ? ` causal=${causalSummary.join(" | ")}`
      : "";
    const redaction = redactedEvidenceRefs.length > 0
      ? ` redacted=${redactedEvidenceRefs.join(",")}`
      : "";
    return `${base}${decision}${factors}${risks}${causal}${redaction}`;
  }
}
