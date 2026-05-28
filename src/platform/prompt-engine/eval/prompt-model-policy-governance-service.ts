/**
 * Prompt, Model, and Policy Governance Service
 *
 * Manages the release lifecycle for prompts, models, and policies with CI gate evaluation.
 * Tracks releases through various stages: draft -> review_required -> approved -> canary -> active.
 * Integrates with LLM evaluation service to gate releases based on quality verdicts.
 */

import { StorageError, ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
export { PROMPT_MODEL_POLICY_GOVERNANCE_DDL } from "./prompt-model-policy-governance-schema.js";
import type { EvalSqlDatabase } from "./eval-storage-port.js";
import type {
  CiGateOptions,
  CiGateResult,
  EvalCaseEvaluator,
  QualityVerdict,
} from "./llm-eval-types.js";
import type { LlmEvalService } from "./llm-eval-service.js";

/** Type of release being governed */
export type GovernanceReleaseType = "prompt" | "model" | "policy";
/** Status of a governance release */
export type GovernanceReleaseStatus =
  | "draft"
  | "review_required"
  | "approved"
  | "canary"
  | "active"
  | "blocked"
  | "rolled_back";
/** Decision made by a governance gate */
export type GovernanceGateDecision =
  | "promote"
  | "hold"
  | "rollback"
  | "degrade_to_fallback";

/**
 * A recorded release in the governance system.
 */
export interface GovernanceReleaseRecord {
  id: string;
  releaseType: GovernanceReleaseType;
  objectKey: string;
  version: string;
  owner: string;
  reviewRequired: boolean;
  rolloutScope: string;
  rollbackVersion: string | null;
  evaluationSuiteId: string | null;
  status: GovernanceReleaseStatus;
  metadata: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A gate evaluation event recording the decision and context.
 */
export interface GovernanceGateEventRecord {
  id: string;
  releaseId: string;
  suiteId: string | null;
  modelId: string;
  promptVersion: string;
  baselinePromptVersion: string | null;
  decision: GovernanceGateDecision;
  verdict: QualityVerdict;
  passed: boolean;
  shouldDegrade: boolean;
  recommendedFallbackKey: string | null;
  summary: string;
  createdAt: string;
  metadata: string | null;
}

/**
 * Metadata specific to prompt releases.
 */
export interface PromptReleaseMetadata {
  lintEvidence: string[];
}

/**
 * Metadata specific to model releases.
 */
export interface ModelReleaseMetadata {
  profileName: string;
  frozenModelId: string;
  fallbackProfiles: string[];
  rollbackProfileName: string | null;
  authProfileRouting: "preferred" | "sticky" | "pinned_allowed";
  sessionAffinity: boolean;
}

/**
 * Metadata specific to policy bundle releases.
 */
export interface PolicyBundleReleaseMetadata {
  changeTicket: string;
  effectiveScope: string;
  denyAllowDeltaSummary: string;
  auditEvidence: string[];
}

/**
 * Combined result of a gate evaluation including the gate result, release state, and event.
 */
export interface GovernanceGateEvaluationResult {
  gate: CiGateResult;
  release: GovernanceReleaseRecord;
  event: GovernanceGateEventRecord;
}

/**
 * Snapshot of model governance state for all active profiles.
 */
export interface ModelGovernanceSnapshot {
  profileStatuses: Record<string, "active" | "degraded" | "disabled">;
  rollbackTargets: Record<string, string | null>;
}

type RawRow = Record<string, unknown>;

/**
 * Service for governing prompts, models, and policies through their release lifecycle.
 *
 * Handles registration of releases, evaluation at gates, status transitions,
 * and maintains rollback targets for degraded scenarios.
 */
export class PromptModelPolicyGovernanceService {
  public constructor(
    private readonly db: EvalSqlDatabase,
    private readonly evalService: LlmEvalService,
  ) {}

  /**
   * Registers a new prompt release in the governance system.
   */
  public registerPromptRelease(input: {
    promptKey: string;
    version: string;
    owner: string;
    reviewRequired?: boolean;
    rolloutScope?: string;
    rollbackVersion?: string | null;
    evaluationSuiteId?: string | null;
    lintEvidence?: string[];
  }): GovernanceReleaseRecord {
    return this.insertRelease({
      releaseType: "prompt",
      objectKey: input.promptKey,
      version: input.version,
      owner: input.owner,
      reviewRequired: input.reviewRequired ?? true,
      rolloutScope: input.rolloutScope ?? "canary",
      rollbackVersion: input.rollbackVersion ?? null,
      evaluationSuiteId: input.evaluationSuiteId ?? null,
      status: input.reviewRequired === false ? "approved" : "review_required",
      metadata: {
        lintEvidence: input.lintEvidence ?? [],
      } satisfies PromptReleaseMetadata,
    });
  }

  /**
   * Registers a new model release in the governance system.
   */
  public registerModelRelease(input: {
    profileName: string;
    version: string;
    owner: string;
    frozenModelId: string;
    fallbackProfiles?: string[];
    rollbackProfileName?: string | null;
    reviewRequired?: boolean;
    rolloutScope?: string;
    evaluationSuiteId?: string | null;
    authProfileRouting?: ModelReleaseMetadata["authProfileRouting"];
    sessionAffinity?: boolean;
  }): GovernanceReleaseRecord {
    const fallbackProfiles = dedupeStrings(input.fallbackProfiles ?? []);
    const rollbackProfileName = normalizeNullableString(
      input.rollbackProfileName ?? fallbackProfiles[0] ?? null,
    );
    return this.insertRelease({
      releaseType: "model",
      objectKey: input.profileName,
      version: input.version,
      owner: input.owner,
      reviewRequired: input.reviewRequired ?? true,
      rolloutScope: input.rolloutScope ?? "canary",
      rollbackVersion: rollbackProfileName,
      evaluationSuiteId: input.evaluationSuiteId ?? null,
      status: input.reviewRequired === false ? "approved" : "review_required",
      metadata: {
        profileName: input.profileName,
        frozenModelId: input.frozenModelId,
        fallbackProfiles,
        rollbackProfileName,
        authProfileRouting: input.authProfileRouting ?? "preferred",
        sessionAffinity: input.sessionAffinity ?? true,
      } satisfies ModelReleaseMetadata,
    });
  }

  /**
   * Registers a new policy bundle release in the governance system.
   */
  public registerPolicyBundleRelease(input: {
    bundleName: string;
    version: string;
    owner: string;
    changeTicket: string;
    effectiveScope: string;
    denyAllowDeltaSummary: string;
    auditEvidence?: string[];
    reviewRequired?: boolean;
    rolloutScope?: string;
    rollbackVersion?: string | null;
    evaluationSuiteId?: string | null;
  }): GovernanceReleaseRecord {
    return this.insertRelease({
      releaseType: "policy",
      objectKey: input.bundleName,
      version: input.version,
      owner: input.owner,
      reviewRequired: input.reviewRequired ?? true,
      rolloutScope: input.rolloutScope ?? "canary",
      rollbackVersion: input.rollbackVersion ?? null,
      evaluationSuiteId: input.evaluationSuiteId ?? null,
      status: input.reviewRequired === false ? "approved" : "review_required",
      metadata: {
        changeTicket: input.changeTicket,
        effectiveScope: input.effectiveScope,
        denyAllowDeltaSummary: input.denyAllowDeltaSummary,
        auditEvidence: input.auditEvidence ?? [],
      } satisfies PolicyBundleReleaseMetadata,
    });
  }

  /**
   * Retrieves a release by ID.
   */
  public getRelease(releaseId: string): GovernanceReleaseRecord | null {
    const row = this.db.connection
      .prepare(`SELECT * FROM governance_releases WHERE id = ?`)
      .get(releaseId) as RawRow | undefined;
    return row ? this.mapRelease(row) : null;
  }

  /**
   * Lists releases, optionally filtered by type.
   */
  public listReleases(releaseType?: GovernanceReleaseType): GovernanceReleaseRecord[] {
    const rows = releaseType == null
      ? (this.db.connection
        .prepare(`SELECT * FROM governance_releases ORDER BY created_at DESC, object_key ASC, version ASC`)
        .all() as RawRow[])
      : (this.db.connection
        .prepare(`SELECT * FROM governance_releases WHERE release_type = ? ORDER BY created_at DESC, object_key ASC, version ASC`)
        .all(releaseType) as RawRow[]);
    return rows.map((row) => this.mapRelease(row));
  }

  /**
   * Lists gate events for a specific release.
   */
  public listGateEvents(releaseId: string): GovernanceGateEventRecord[] {
    const rows = this.db.connection
      .prepare(`SELECT * FROM governance_gate_events WHERE release_id = ? ORDER BY created_at DESC`)
      .all(releaseId) as RawRow[];
    return rows.map((row) => this.mapGateEvent(row));
  }

  /**
   * Evaluates a release at its governance gate, determining whether it can proceed.
   *
   * Runs the associated evaluation suite and makes a promotion decision
   * based on the quality verdict and regression analysis.
   */
  public evaluateReleaseGate(input: {
    releaseId: string;
    modelId: string;
    promptVersion: string;
    baselinePromptVersion?: string | null;
    evaluator?: EvalCaseEvaluator;
    promoteTo?: Extract<GovernanceReleaseStatus, "canary" | "active">;
    passingVerdicts?: readonly QualityVerdict[];
    improvementScoreThreshold?: number;
  }): GovernanceGateEvaluationResult {
    const release = this.requireRelease(input.releaseId);
    const suiteId = normalizeNullableString(release.evaluationSuiteId);
    if (suiteId == null) {
      throw new ValidationError(
        `governance.release_missing_eval_suite:${release.id}`,
        `governance.release_missing_eval_suite:${release.id}`,
        {
          retryable: false,
          details: { releaseId: release.id },
        },
      );
    }

    const gateOptions: CiGateOptions = {
      baselinePromptVersion: input.baselinePromptVersion ?? null,
    };
    if (input.evaluator != null) {
      gateOptions.evaluator = input.evaluator;
    }
    if (input.passingVerdicts != null) {
      gateOptions.passingVerdicts = input.passingVerdicts;
    }
    if (input.improvementScoreThreshold != null) {
      gateOptions.improvementScoreThreshold = input.improvementScoreThreshold;
    }

    const gate = this.evalService.runCiGate(
      suiteId,
      input.modelId,
      input.promptVersion,
      gateOptions,
    );

    const decision = determineGateDecision(release, gate);
    const nextStatus = determineNextReleaseStatus(release, gate, input.promoteTo ?? "active");
    const recommendedFallbackKey = resolveRecommendedFallbackKey(release);
    const shouldDegrade = decision === "degrade_to_fallback";
    const createdAt = nowIso();
    const event: GovernanceGateEventRecord = {
      id: newId("govgate"),
      releaseId: release.id,
      suiteId,
      modelId: input.modelId,
      promptVersion: input.promptVersion,
      baselinePromptVersion: input.baselinePromptVersion ?? null,
      decision,
      verdict: gate.verdict,
      passed: gate.passed,
      shouldDegrade,
      recommendedFallbackKey: shouldDegrade ? recommendedFallbackKey : null,
      summary: gate.summary,
      createdAt,
      metadata: JSON.stringify({
        regressions: gate.regressions,
        improvements: gate.improvements,
      }),
    };

    const persistGovernanceEvent = () => {
      this.db.connection
        .prepare(`INSERT INTO governance_gate_events (id, release_id, suite_id, model_id, prompt_version, baseline_prompt_version, decision, verdict, passed, should_degrade, recommended_fallback_key, summary, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          event.id,
          event.releaseId,
          event.suiteId,
          event.modelId,
          event.promptVersion,
          event.baselinePromptVersion,
          event.decision,
          event.verdict,
          event.passed ? 1 : 0,
          event.shouldDegrade ? 1 : 0,
          event.recommendedFallbackKey,
          event.summary,
          event.createdAt,
          event.metadata,
        );

      this.promoteSiblingRollbackState(release, nextStatus);

      this.db.connection
        .prepare(`UPDATE governance_releases SET status = ?, updated_at = ? WHERE id = ?`)
        .run(nextStatus, createdAt, release.id);
    };
    if (this.db.transaction != null) {
      this.db.transaction(persistGovernanceEvent);
    } else {
      persistGovernanceEvent();
    }

    return {
      gate,
      release: this.requireRelease(release.id),
      event,
    };
  }

  /**
   * Builds a snapshot of model governance state across all profiles.
   *
   * Used by runtime to determine which models are active, degraded, or disabled
   * and what rollback targets are available.
   */
  public buildModelGovernanceSnapshot(): ModelGovernanceSnapshot {
    const releases = this.listReleases("model");
    const latestByProfile = new Map<string, GovernanceReleaseRecord>();
    for (const release of releases) {
      if (!latestByProfile.has(release.objectKey)) {
        latestByProfile.set(release.objectKey, release);
      }
    }

    const profileStatuses: Record<string, "active" | "degraded" | "disabled"> = {};
    const rollbackTargets: Record<string, string | null> = {};

    for (const [profileName, release] of latestByProfile.entries()) {
      profileStatuses[profileName] = mapReleaseStatusToProfileStatus(release.status);
      rollbackTargets[profileName] = resolveRecommendedFallbackKey(release);
    }

    return {
      profileStatuses,
      rollbackTargets,
    };
  }

  /**
   * Inserts a new release record into the database.
   */
  private insertRelease(input: {
    releaseType: GovernanceReleaseType;
    objectKey: string;
    version: string;
    owner: string;
    reviewRequired: boolean;
    rolloutScope: string;
    rollbackVersion: string | null;
    evaluationSuiteId: string | null;
    status: GovernanceReleaseStatus;
    metadata: Record<string, unknown>;
  }): GovernanceReleaseRecord {
    const now = nowIso();
    const record: GovernanceReleaseRecord = {
      id: newId("govrel"),
      releaseType: input.releaseType,
      objectKey: normalizeRequiredString(input.objectKey, "governance.invalid_object_key"),
      version: normalizeRequiredString(input.version, "governance.invalid_version"),
      owner: normalizeRequiredString(input.owner, "governance.invalid_owner"),
      reviewRequired: input.reviewRequired,
      rolloutScope: normalizeRequiredString(input.rolloutScope, "governance.invalid_rollout_scope"),
      rollbackVersion: normalizeNullableString(input.rollbackVersion),
      evaluationSuiteId: normalizeNullableString(input.evaluationSuiteId),
      status: input.status,
      metadata: JSON.stringify(input.metadata),
      createdAt: now,
      updatedAt: now,
    };

    this.db.connection
      .prepare(`INSERT INTO governance_releases (id, release_type, object_key, version, owner, review_required, rollout_scope, rollback_version, evaluation_suite_id, status, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        record.id,
        record.releaseType,
        record.objectKey,
        record.version,
        record.owner,
        record.reviewRequired ? 1 : 0,
        record.rolloutScope,
        record.rollbackVersion,
        record.evaluationSuiteId,
        record.status,
        record.metadata,
        record.createdAt,
        record.updatedAt,
      );

    return record;
  }

  /**
   * Rolls back sibling releases when a new one becomes active.
   */
  private promoteSiblingRollbackState(
    release: GovernanceReleaseRecord,
    nextStatus: GovernanceReleaseStatus,
  ): void {
    if (nextStatus !== "active") {
      return;
    }
    this.db.connection
      .prepare(`UPDATE governance_releases SET status = ?, updated_at = ? WHERE release_type = ? AND object_key = ? AND id != ? AND status = 'active'`)
      .run("rolled_back", nowIso(), release.releaseType, release.objectKey, release.id);
  }

  /**
   * Retrieves a release, throwing if not found.
   */
  private requireRelease(releaseId: string): GovernanceReleaseRecord {
    const release = this.getRelease(releaseId);
    if (release == null) {
      throw new StorageError(`governance.release_not_found:${releaseId}`, `governance.release_not_found:${releaseId}`, {
        statusCode: 404,
        retryable: false,
        details: { releaseId },
      });
    }
    return release;
  }

  /**
   * Maps a database row to a GovernanceReleaseRecord.
   */
  private mapRelease(row: RawRow): GovernanceReleaseRecord {
    return {
      id: String(row.id),
      releaseType: String(row.release_type) as GovernanceReleaseType,
      objectKey: String(row.object_key ?? ""),
      version: String(row.version ?? ""),
      owner: String(row.owner ?? ""),
      reviewRequired: Boolean(row.review_required),
      rolloutScope: String(row.rollout_scope ?? ""),
      rollbackVersion: row.rollback_version != null ? String(row.rollback_version) : null,
      evaluationSuiteId: row.evaluation_suite_id != null ? String(row.evaluation_suite_id) : null,
      status: String(row.status ?? "draft") as GovernanceReleaseStatus,
      metadata: String(row.metadata ?? "{}"),
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    };
  }

  /**
   * Maps a database row to a GovernanceGateEventRecord.
   */
  private mapGateEvent(row: RawRow): GovernanceGateEventRecord {
    return {
      id: String(row.id),
      releaseId: String(row.release_id ?? ""),
      suiteId: row.suite_id != null ? String(row.suite_id) : null,
      modelId: String(row.model_id ?? ""),
      promptVersion: String(row.prompt_version ?? ""),
      baselinePromptVersion: row.baseline_prompt_version != null ? String(row.baseline_prompt_version) : null,
      decision: String(row.decision ?? "hold") as GovernanceGateDecision,
      verdict: String(row.verdict ?? "inconclusive") as QualityVerdict,
      passed: Boolean(row.passed),
      shouldDegrade: Boolean(row.should_degrade),
      recommendedFallbackKey: row.recommended_fallback_key != null ? String(row.recommended_fallback_key) : null,
      summary: String(row.summary ?? ""),
      createdAt: String(row.created_at ?? ""),
      metadata: row.metadata != null ? String(row.metadata) : null,
    };
  }
}

/**
 * Determines the gate decision based on the evaluation result and release type.
 */
function determineGateDecision(
  release: GovernanceReleaseRecord,
  gate: CiGateResult,
): GovernanceGateDecision {
  if (gate.passed) {
    return gate.verdict === "degraded" ? "hold" : "promote";
  }
  return release.releaseType === "model" && resolveRecommendedFallbackKey(release) != null
    ? "degrade_to_fallback"
    : "rollback";
}

/**
 * Determines the next status for a release based on gate results.
 */
function determineNextReleaseStatus(
  release: GovernanceReleaseRecord,
  gate: CiGateResult,
  promoteTo: Extract<GovernanceReleaseStatus, "canary" | "active">,
): GovernanceReleaseStatus {
  if (gate.passed) {
    return gate.verdict === "degraded" ? "canary" : promoteTo;
  }
  return release.releaseType === "model" ? "blocked" : "rolled_back";
}

/**
 * Resolves the recommended fallback key for a release.
 */
function resolveRecommendedFallbackKey(
  release: GovernanceReleaseRecord,
): string | null {
  if (release.releaseType !== "model") {
    return release.rollbackVersion;
  }
  const metadata = parseModelReleaseMetadata(release.metadata);
  return normalizeNullableString(metadata.rollbackProfileName)
    ?? normalizeNullableString(metadata.fallbackProfiles?.[0] ?? null)
    ?? release.rollbackVersion;
}

function parseModelReleaseMetadata(raw: string): Partial<ModelReleaseMetadata> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError(
      "prompt_model_policy.invalid_release_metadata",
      "prompt_model_policy.invalid_release_metadata",
      { retryable: false },
    );
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ValidationError(
      "prompt_model_policy.invalid_release_metadata",
      "prompt_model_policy.invalid_release_metadata",
      { retryable: false },
    );
  }
  const record = parsed as Record<string, unknown>;
  const fallbackProfiles = Array.isArray(record.fallbackProfiles)
    ? record.fallbackProfiles.filter((value): value is string => typeof value === "string")
    : undefined;
  return {
    ...(typeof record.rollbackProfileName === "string" ? { rollbackProfileName: record.rollbackProfileName } : {}),
    ...(fallbackProfiles != null ? { fallbackProfiles } : {}),
  };
}

/**
 * Maps release status to profile status.
 */
function mapReleaseStatusToProfileStatus(
  status: GovernanceReleaseStatus,
): "active" | "degraded" | "disabled" {
  switch (status) {
    case "active":
    case "approved":
    case "canary":
      return "active";
    case "blocked":
      return "degraded";
    case "rolled_back":
      return "disabled";
    default:
      return "degraded";
  }
}

/**
 * Validates and normalizes a required string value.
 */
function normalizeRequiredString(value: string, reasonCode: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(reasonCode, reasonCode, {
      retryable: false,
    });
  }
  return trimmed;
}

/**
 * Normalizes a nullable string value.
 */
function normalizeNullableString(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Deduplicates a list of strings after trimming.
 */
function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}
