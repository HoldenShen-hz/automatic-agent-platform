import { createHash } from "node:crypto";

import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import type { MemoryRecord } from "../../contracts/types/domain.js";
import {
  MemoryService,
  type ConsolidateMemoriesInput,
  type RememberMemoryInput,
} from "../memory/memory-service.js";
import { BuiltInMemoryProvider } from "../memory/builtin-memory-provider.js";
import { ExperienceCacheService } from "../memory/experience-cache-service.js";
import { parseStructuredMemoryContent, type StructuredMemoryContent } from "../memory/memory-schema.js";

export { MemoryService, type ConsolidateMemoriesInput, type RememberMemoryInput } from "../memory/memory-service.js";
export { BuiltInMemoryProvider } from "../memory/builtin-memory-provider.js";
export { ExperienceCacheService } from "../memory/experience-cache-service.js";
export { MemoryPrivacyWorkflowService } from "./privacy-workflow.js";
export type {
  MemoryProvider,
  MemoryProviderInitializeResult,
  MemoryProviderPrefetchResult,
  MemoryProviderPromptBlock,
  MemoryProviderQuery,
  MemoryProviderShutdownResult,
  MemoryTurnSyncInput,
  MemoryTurnSyncResult,
  QueuedMemoryPrefetch,
} from "../memory/memory-provider.js";
export type { StructuredMemoryContent } from "../memory/memory-schema.js";

export type DataSensitivity = "public" | "internal" | "confidential" | "restricted";
export type ManagedMemoryLayer = "L1" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7";
export type ManagedMemoryScope =
  | "task"
  | "session"
  | "mission"
  | "project"
  | "domain"
  | "user"
  | "team"
  | "organization"
  | "governance";

export interface ManagedMemoryMinimal {
  memoryId: string;
  layer: ManagedMemoryLayer;
  tenantId: string;
  scope: ManagedMemoryScope;
  status: "proposed" | "active" | "quarantined" | "revoked" | "expired" | "superseded";
  subject: string;
  contentRef: string;
  sourceEvidenceIds: string[];
  sourceTraceIds: string[];
  confidence: number;
  sensitivity: DataSensitivity;
  createdBy: "model" | "human" | "system";
  approvedBy?: string;
  validFrom: string;
  validUntil?: string;
  version: number;
  supersedes?: string[];
  conflictSet?: string[];
  accessPolicyId: string;
  retentionPolicyId: string;
}

export interface MemoryProposal {
  proposalId: string;
  missionId: string;
  tenantId: string;
  actorId: string;
  proposedLayer: ManagedMemoryLayer;
  proposedScope: ManagedMemoryScope;
  contentRef: string;
  sourceEvidenceIds: string[];
  sourceTraceIds: string[];
  confidence: number;
  sensitivity: DataSensitivity;
  rationale: string;
}

export interface MemoryCommitDecision {
  decisionId: string;
  proposalId: string;
  decision: "approve" | "reject" | "quarantine" | "require_more_evidence";
  committedMemoryId?: string;
  approvalId?: string;
  reasons: string[];
}

export interface MemoryRevokeDecision {
  decisionId: string;
  memoryId: string;
  decision: "revoke" | "expire" | "supersede" | "keep_active";
  reason: string;
  projectionInvalidationRequired: boolean;
  indexInvalidationRequired: boolean;
}

export interface MemoryProjection {
  projectionId: string;
  missionId: string;
  sessionId?: string;
  taskId?: string;
  tenantId: string;
  allowedLayers: ManagedMemoryLayer[];
  memoryIds: string[];
  evidenceIds: string[];
  tokenBudget: number;
  redactionApplied: boolean;
  projectionHash: string;
  createdAt: string;
}

export interface MemoryGatewayRememberInput extends RememberMemoryInput {
  tenantId: string;
  scopeKind?: ManagedMemoryScope;
  subject?: string;
  sensitivity?: DataSensitivity;
  accessPolicyId?: string;
  retentionPolicyId?: string;
  approvedBy?: string;
}

export interface MemoryGatewayCommitInput {
  proposal: MemoryProposal;
  remember: RememberMemoryInput;
  approvedBy?: string;
  approvalId?: string;
  reasons?: readonly string[];
}

export interface MemoryGatewayProjectionInput {
  missionId: string;
  tenantId: string;
  memoryIds: readonly string[];
  evidenceIds?: readonly string[];
  allowedLayers: readonly ManagedMemoryLayer[];
  tokenBudget: number;
  redactionApplied?: boolean;
  sessionId?: string;
  taskId?: string;
}

const HIGHER_LAYER_SET = new Set<ManagedMemoryLayer>(["L4", "L5", "L6", "L7"]);

export class MemoryGateway {
  public constructor(private readonly memoryService: MemoryService) {}

  public rememberDirect(input: MemoryGatewayRememberInput): ManagedMemoryMinimal {
    const layer = mapRuntimeMemoryLayerToManagedMemoryLayer(input.memoryLayer ?? "layer_3");
    if (HIGHER_LAYER_SET.has(layer)) {
      throw new ValidationError(
        "memory.direct_commit_requires_proposal",
        "memory.direct_commit_requires_proposal",
        { details: { layer } },
      );
    }
    const record = this.memoryService.remember(input);
    return toManagedMemoryMinimal(record, buildManagedMemoryContext(
      input.tenantId,
      {
        ...(input.scopeKind != null ? { scope: input.scopeKind } : {}),
        ...(input.subject != null ? { subject: input.subject } : {}),
        ...(input.sensitivity != null ? { sensitivity: input.sensitivity } : {}),
        ...(input.accessPolicyId != null ? { accessPolicyId: input.accessPolicyId } : {}),
        ...(input.retentionPolicyId != null ? { retentionPolicyId: input.retentionPolicyId } : {}),
        ...(input.approvedBy != null ? { approvedBy: input.approvedBy } : {}),
      },
    ));
  }

  public proposeMemory(input: Omit<MemoryProposal, "proposalId"> & { proposalId?: string }): MemoryProposal {
    return {
      proposalId: input.proposalId ?? newId("mem_prop"),
      missionId: input.missionId,
      tenantId: input.tenantId,
      actorId: input.actorId,
      proposedLayer: input.proposedLayer,
      proposedScope: input.proposedScope,
      contentRef: input.contentRef,
      sourceEvidenceIds: [...input.sourceEvidenceIds],
      sourceTraceIds: [...input.sourceTraceIds],
      confidence: input.confidence,
      sensitivity: input.sensitivity,
      rationale: input.rationale,
    };
  }

  public commitProposal(
    input: MemoryGatewayCommitInput & {
      tenantId: string;
      scopeKind?: ManagedMemoryScope;
      subject?: string;
      sensitivity?: DataSensitivity;
      accessPolicyId?: string;
      retentionPolicyId?: string;
    },
  ): { decision: MemoryCommitDecision; memory: ManagedMemoryMinimal } {
    const record = this.memoryService.remember({
      ...input.remember,
      memoryLayer: mapManagedMemoryLayerToRuntimeMemoryLayer(input.proposal.proposedLayer),
    });
    const decision: MemoryCommitDecision = {
      decisionId: newId("mem_dec"),
      proposalId: input.proposal.proposalId,
      decision: "approve",
      committedMemoryId: record.id,
      reasons: [...(input.reasons ?? [])],
      ...(input.approvalId != null ? { approvalId: input.approvalId } : {}),
    };
    return {
      decision,
      memory: toManagedMemoryMinimal(record, buildManagedMemoryContext(
        input.tenantId,
        {
          scope: input.scopeKind ?? input.proposal.proposedScope,
          ...(input.subject != null ? { subject: input.subject } : {}),
          sensitivity: input.sensitivity ?? input.proposal.sensitivity,
          ...(input.accessPolicyId != null ? { accessPolicyId: input.accessPolicyId } : {}),
          ...(input.retentionPolicyId != null ? { retentionPolicyId: input.retentionPolicyId } : {}),
          ...(input.approvedBy != null ? { approvedBy: input.approvedBy } : {}),
        },
      )),
    };
  }

  public revokeManagedMemory(
    memoryId: string,
    reason: string,
    decision: MemoryRevokeDecision["decision"] = "revoke",
  ): MemoryRevokeDecision {
    if (decision === "revoke" || decision === "expire") {
      this.memoryService.revoke(memoryId, reason, nowIso());
    }
    return {
      decisionId: newId("mem_rev"),
      memoryId,
      decision,
      reason,
      projectionInvalidationRequired: decision !== "keep_active",
      indexInvalidationRequired: decision !== "keep_active",
    };
  }

  public buildProjection(input: MemoryGatewayProjectionInput): MemoryProjection {
    const projectionHash = createHash("sha256")
      .update(JSON.stringify({
        missionId: input.missionId,
        tenantId: input.tenantId,
        memoryIds: [...input.memoryIds],
        evidenceIds: [...(input.evidenceIds ?? [])],
        allowedLayers: [...input.allowedLayers],
        tokenBudget: input.tokenBudget,
        redactionApplied: input.redactionApplied ?? false,
      }))
      .digest("hex");
    return {
      projectionId: newId("mem_proj"),
      missionId: input.missionId,
      tenantId: input.tenantId,
      memoryIds: [...input.memoryIds],
      evidenceIds: [...(input.evidenceIds ?? [])],
      allowedLayers: [...input.allowedLayers],
      tokenBudget: input.tokenBudget,
      redactionApplied: input.redactionApplied ?? false,
      projectionHash,
      createdAt: nowIso(),
      ...(input.sessionId != null ? { sessionId: input.sessionId } : {}),
      ...(input.taskId != null ? { taskId: input.taskId } : {}),
    };
  }

  public getMemoryService(): MemoryService {
    return this.memoryService;
  }
}

export function mapRuntimeMemoryLayerToManagedMemoryLayer(layer: MemoryRecord["memoryLayer"]): ManagedMemoryLayer {
  if (layer === "layer_7") {
    return "L7";
  }
  if (layer === "layer_5") {
    return "L5";
  }
  return "L3";
}

export function mapManagedMemoryLayerToRuntimeMemoryLayer(layer: ManagedMemoryLayer): MemoryRecord["memoryLayer"] {
  if (layer === "L6" || layer === "L7") {
    return "layer_7";
  }
  if (layer === "L4" || layer === "L5") {
    return "layer_5";
  }
  return "layer_3";
}

export function toManagedMemoryMinimal(
  record: MemoryRecord,
  context: {
    tenantId: string;
    scope?: ManagedMemoryScope;
    subject?: string;
    sensitivity?: DataSensitivity;
    accessPolicyId?: string;
    retentionPolicyId?: string;
    approvedBy?: string;
  },
): ManagedMemoryMinimal {
  const content = parseStructuredMemoryContent(record.contentJson);
  const metadata = content.metadata;
  return {
    memoryId: record.id,
    layer: mapRuntimeMemoryLayerToManagedMemoryLayer(record.memoryLayer),
    tenantId: context.tenantId,
    scope: context.scope ?? mapRuntimeScopeToManagedScope(record.scope),
    status: mapMemoryStatus(record),
    subject: context.subject ?? deriveMemorySubject(record, content),
    contentRef: `memory:${record.id}`,
    sourceEvidenceIds: readStringArray(metadata["sourceEvidenceIds"]),
    sourceTraceIds: readStringArray(metadata["sourceTraceIds"]),
    confidence: record.qualityScore ?? 0,
    sensitivity: context.sensitivity ?? inferSensitivity(record.classification),
    createdBy: inferCreatedBy(metadata["createdBy"]),
    validFrom: record.createdAt,
    version: Number.isFinite(Number(metadata["version"])) ? Number(metadata["version"]) : 1,
    accessPolicyId: context.accessPolicyId ?? "memory.default.access",
    retentionPolicyId: context.retentionPolicyId ?? "memory.default.retention",
    ...(context.approvedBy != null ? { approvedBy: context.approvedBy } : {}),
    ...(record.expiresAt != null ? { validUntil: record.expiresAt } : {}),
    ...(readStringArray(metadata["supersedes"]).length > 0 ? { supersedes: readStringArray(metadata["supersedes"]) } : {}),
    ...(readStringArray(metadata["conflictSet"]).length > 0 ? { conflictSet: readStringArray(metadata["conflictSet"]) } : {}),
  };
}

function deriveMemorySubject(record: MemoryRecord, content: StructuredMemoryContent): string {
  return content.workContext
    ?? content.topOfMind[0]
    ?? content.recentHistory[0]
    ?? content.facts[0]?.content
    ?? `${record.scope}:${record.id}`;
}

function inferSensitivity(classification: string): DataSensitivity {
  const normalized = classification.trim().toLowerCase();
  if (normalized.includes("restricted")) {
    return "restricted";
  }
  if (normalized.includes("confidential") || normalized.includes("secret")) {
    return "confidential";
  }
  if (normalized.includes("public")) {
    return "public";
  }
  return "internal";
}

function inferCreatedBy(value: unknown): ManagedMemoryMinimal["createdBy"] {
  return value === "model" || value === "human" || value === "system" ? value : "system";
}

function mapMemoryStatus(record: MemoryRecord): ManagedMemoryMinimal["status"] {
  if (record.revokedAt != null) {
    return "revoked";
  }
  if (record.status === "superseded") {
    return "superseded";
  }
  if (record.expiresAt != null && record.expiresAt <= nowIso()) {
    return "expired";
  }
  return "active";
}

function mapRuntimeScopeToManagedScope(scope: string): ManagedMemoryScope {
  switch (scope) {
    case "task":
    case "session":
    case "mission":
    case "project":
    case "domain":
    case "user":
    case "team":
    case "organization":
    case "governance":
      return scope;
    default:
      return "project";
  }
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function buildManagedMemoryContext(
  tenantId: string,
  input: {
    scope?: ManagedMemoryScope;
    subject?: string;
    sensitivity?: DataSensitivity;
    accessPolicyId?: string;
    retentionPolicyId?: string;
    approvedBy?: string;
  },
): {
  tenantId: string;
  scope?: ManagedMemoryScope;
  subject?: string;
  sensitivity?: DataSensitivity;
  accessPolicyId?: string;
  retentionPolicyId?: string;
  approvedBy?: string;
} {
  return {
    tenantId,
    ...(input.scope != null ? { scope: input.scope } : {}),
    ...(input.subject != null ? { subject: input.subject } : {}),
    ...(input.sensitivity != null ? { sensitivity: input.sensitivity } : {}),
    ...(input.accessPolicyId != null ? { accessPolicyId: input.accessPolicyId } : {}),
    ...(input.retentionPolicyId != null ? { retentionPolicyId: input.retentionPolicyId } : {}),
    ...(input.approvedBy != null ? { approvedBy: input.approvedBy } : {}),
  };
}
