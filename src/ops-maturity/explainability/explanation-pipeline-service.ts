import { createHash } from "node:crypto";
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
  readonly recordedFacts: readonly string[];
  readonly modelRationales: readonly string[];
  readonly inferredSummary: string;
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
  readonly versionLockRef: string;
  readonly rendered: string;
  readonly causalSummary: readonly string[];
  readonly redactedEvidenceRefs: readonly string[];
  readonly cacheKey: string;
}

export interface ExplanationGenerateOptions {
  readonly alternatives?: readonly string[];
  readonly confidence?: number;
  readonly decisionInputRef?: string;
  readonly versionLockRef?: string;
  readonly visibilityLabels?: readonly string[];
  readonly recordedFacts?: readonly string[];
  readonly modelRationales?: readonly string[];
  readonly inferredSummary?: string;
  readonly forensicBudgetReservationId?: string;
  readonly auditUserId?: string;
  readonly auditIpAddress?: string;
  readonly auditUserAgent?: string;
}

export interface ExplanationAuditTrailEntry {
  readonly auditEntryId: string;
  readonly rationaleId: string;
  readonly explanationId: string;
  readonly accessType: "generate" | "view";
  readonly audience: "business" | "technical" | "audit" | null;
  readonly userId: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly recordedAt: string;
}

export interface ExplanationViewOptions {
  readonly userId?: string;
  readonly audience?: "business" | "technical" | "audit";
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export interface ExplanationPipelineServiceDeps {
  readonly validateForensicBudgetReservation?: (reservationId: string) => void;
}

function explanationCacheKey(taskId: string, stageId: string, depth: ExplanationDepth): string {
  const depthKey = depth === "L3" ? "audit" : depth;
  return `${taskId}:${stageId}:${depthKey}`;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function audienceForDepth(depth: ExplanationDepth): "business" | "technical" | "audit" {
  switch (depth) {
    case "L1":
      return "business";
    case "L3":
      return "audit";
    default:
      return "technical";
  }
}

function buildVersionLockRef(rationale: Omit<StageRationale, "versionLockRef">): string {
  let serialized: string;
  try {
    serialized = JSON.stringify(rationale);
  } catch (error) {
    throw new Error(
      `explanation.version_lock_serialization_failed:${rationale.rationaleId}:${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const digest = createHash("sha256")
    .update(serialized)
    .digest("hex")
    .slice(0, 24);
  return `vlock:${digest}`;
}

export class ExplanationPipelineService {
  private cache: Record<string, ExplanationCacheEntry> = {};
  private readonly versionLocks = new Map<string, string>();
  private readonly auditTrail = new Map<string, ExplanationAuditTrailEntry[]>();

  public constructor(private readonly deps: ExplanationPipelineServiceDeps = {}) {}

  public generate(
    request: ExplanationRequest,
    depth: ExplanationDepth = "L2",
    options: ExplanationGenerateOptions = {},
  ): ExplanationBundle {
    if (depth === "L3") {
      this.assertForensicBudgetReservation(options.forensicBudgetReservationId);
    }
    const stageId = request.stageId ?? request.stage ?? "unknown";
    const allowedCategories = new Set(request.allowedEvidenceCategories ?? request.evidence.map((item) => item.category));
    const visibleEvidence = request.evidence.filter((item) => allowedCategories.has(item.category));
    const hiddenEvidence = request.evidence.filter((item) => !allowedCategories.has(item.category));
    const evidenceRefs = collectExplanationEvidenceIds(visibleEvidence);
    const redactedEvidenceRefs = collectExplanationEvidenceIds(hiddenEvidence);
    const rationaleId = newId("rationale");
    const summary = options.inferredSummary ?? request.summary;
    // @ts-expect-error - exactOptionalPropertyTypes complexity with Omit
    const rationaleWithoutLock: Omit<StageRationale, "versionLockRef"> = {
      rationaleId,
      taskId: request.taskId,
      stageId,
      decision: request.decision ?? "accept",
      summary,
      recordedFacts: uniqueStrings(options.recordedFacts ?? [
        `decision:${request.decision ?? "accept"}`,
        ...evidenceRefs.map((ref) => `evidence:${ref}`),
        ...uniqueStrings(request.riskNotes).map((note) => `risk:${note}`),
      ]),
      modelRationales: uniqueStrings(options.modelRationales ?? request.decisionFactors),
      inferredSummary: summary,
      decisionFactors: uniqueStrings(request.decisionFactors),
      evidenceRefs,
      riskNotes: uniqueStrings(request.riskNotes),
      alternatives: options.alternatives ? uniqueStrings(options.alternatives) : undefined,
      confidence: options.confidence,
      decisionInputRef: options.decisionInputRef,
      visibilityLabels: options.visibilityLabels ? uniqueStrings(options.visibilityLabels) : undefined,
      generatedAt: request.generatedAt ?? nowIso(),
    };
    const versionLockRef = options.versionLockRef ?? buildVersionLockRef(rationaleWithoutLock);
    const causalSummary = buildCausalChainSummary(request.causalLinks ?? []);
    const cacheKey = explanationCacheKey(request.taskId, stageId, depth);
    const rendered = this.renderBundle({ ...rationaleWithoutLock, versionLockRef }, depth, causalSummary, redactedEvidenceRefs);
    const rationale: StageRationale = {
      ...rationaleWithoutLock,
      versionLockRef,
      renderedExplanation: rendered,
    };

    this.cache = putExplanationCacheEntry(this.cache, {
      cacheKey,
      summary: rationale.inferredSummary,
      ttlHours: depth === "L3" ? 0 : 24,
    });
    this.versionLocks.set(rationale.rationaleId, versionLockRef);

    const explanationId = newId("explanation");
    this.appendAuditEntry(rationale.rationaleId, {
      auditEntryId: newId("explanation_audit"),
      rationaleId: rationale.rationaleId,
      explanationId,
      accessType: "generate",
      audience: audienceForDepth(depth),
      userId: options.auditUserId ?? null,
      ipAddress: options.auditIpAddress ?? null,
      userAgent: options.auditUserAgent ?? null,
      recordedAt: rationale.generatedAt,
    });

    return {
      explanationId,
      depth,
      rationale,
      versionLockRef,
      rendered,
      causalSummary,
      redactedEvidenceRefs,
      cacheKey,
    };
  }

  public getCached(cacheKey: string): ExplanationCacheEntry | null {
    return this.cache[cacheKey] ?? null;
  }

  public verifyVersionLock(rationaleId: string, versionLockRef: string): boolean {
    const stored = this.versionLocks.get(rationaleId);
    if (stored === undefined) return false;
    return stored === versionLockRef;
  }

  public isVersionLocked(rationaleId: string): boolean {
    return this.versionLocks.has(rationaleId);
  }

  public recordExplanationView(
    rationaleId: string,
    explanationId: string,
    options: ExplanationViewOptions = {},
  ): void {
    this.appendAuditEntry(rationaleId, {
      auditEntryId: newId("explanation_audit"),
      rationaleId,
      explanationId,
      accessType: "view",
      audience: options.audience ?? null,
      userId: options.userId ?? null,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
      recordedAt: nowIso(),
    });
  }

  public getAuditTrail(rationaleId: string): ExplanationAuditTrailEntry[] {
    return [...(this.auditTrail.get(rationaleId) ?? [])];
  }

  private renderBundle(
    rationale: StageRationale,
    depth: ExplanationDepth,
    causalSummary: readonly string[],
    redactedEvidenceRefs: readonly string[],
  ): string {
    const base = renderStageExplanation(rationale.stageId, rationale.inferredSummary, rationale.evidenceRefs);
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

    const facts = rationale.recordedFacts.length > 0
      ? ` facts=${rationale.recordedFacts.join("; ")}`
      : "";
    const model = rationale.modelRationales.length > 0
      ? ` model=${rationale.modelRationales.join("; ")}`
      : "";
    const inferred = ` inferred=${rationale.inferredSummary}`;
    const causal = causalSummary.length > 0
      ? ` causal=${causalSummary.join(" | ")}`
      : "";
    const redaction = redactedEvidenceRefs.length > 0
      ? ` redacted=${redactedEvidenceRefs.join(",")}`
      : "";
    return `${base}${decision}${factors}${risks}${facts}${model}${inferred}${causal}${redaction}`;
  }

  private appendAuditEntry(rationaleId: string, entry: ExplanationAuditTrailEntry): void {
    this.auditTrail.set(rationaleId, [...(this.auditTrail.get(rationaleId) ?? []), entry]);
  }

  private assertForensicBudgetReservation(reservationId: string | undefined): void {
    if (reservationId == null || reservationId.trim().length === 0) {
      throw new Error("explanation.forensic_budget_required");
    }
    this.deps.validateForensicBudgetReservation?.(reservationId);
  }
}
