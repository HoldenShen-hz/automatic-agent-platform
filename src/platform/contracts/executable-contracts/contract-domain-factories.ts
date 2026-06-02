import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";
import type { MissionRef } from "../mission/index.js";
import type {
  AmbiguityPolicy,
  ArtifactRef,
  BudgetIntent,
  ConfirmedTaskSpec,
  JsonValue,
  PrincipalRef,
  RequestEnvelope,
  RiskClass,
  RiskPreview,
  TaskDraft,
  TaskInputSource,
  UserConfirmationReceipt,
} from "./contract-models.js";

const LEGACY_DOMAIN_BINDING_ALIASES = {
  "general-ops": "project-management",
  platform_engineering: "coding",
  engineering: "coding",
  content_production: "creative-production",
  content: "creative-production",
  design: "creative-production",
  "engineering-ops": "coding",
  operations: "it-operations",
  data_analysis: "data-engineering",
  data: "data-engineering",
  analytics: "data-engineering",
  quality_assurance: "quality-assurance",
  qa: "quality-assurance",
  security: "content-moderation",
  support: "customer-service",
  communications: "marketing",
  hr: "human-resources",
  finance: "finance-accounting",
  devops: "it-operations",
  "data-processing": "data-engineering",
  "data-analytics": "data-engineering",
  "enterprise-knowledge-base": "knowledge-base",
  "quantitative-trading": "quant-trading",
  "advertising-promotion": "advertising",
  sales: "ecommerce",
  "online-livestream": "live-streaming",
  "medical-health": "healthcare",
  "supply-chain-logistics": "supply-chain",
  "education-training": "education",
  "advertising-creative": "creative-production",
  "marketing-brand": "marketing",
} as const;

const DOMAIN_BINDING_FIELD_NAMES = [
  "domainId",
  "domain_id",
  "divisionId",
  "division_id",
  "domainHint",
  "domain_hint",
  "baselineDomainId",
  "baseline_domain_id",
] as const;

export function requireNonEmpty(value: string, code: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(code, `${code}: Required string cannot be empty.`);
  }
}

export function isHighRisk(riskClass: RiskClass): boolean {
  return riskClass === "high" || riskClass === "critical";
}

export function createPrincipalRef(input: {
  principalId: string;
  type?: PrincipalRef["type"];
  tenantId: string;
  roles?: readonly string[];
  displayName?: string;
  authorizationLevel?: "viewer" | "operator" | "admin";
}): PrincipalRef {
  requireNonEmpty(input.principalId, "principal.principal_id_required");
  requireNonEmpty(input.tenantId, "principal.tenant_id_required");
  return {
    principalId: input.principalId,
    type: input.type ?? "human",
    tenantId: input.tenantId,
    roles: input.roles ?? [],
    ...(input.displayName != null ? { displayName: input.displayName } : {}),
    ...(input.authorizationLevel != null ? { authorizationLevel: input.authorizationLevel } : {}),
  } as PrincipalRef;
}

export function normalizeDomainBindingId(domainId: string): string {
  requireNonEmpty(domainId, "domain_binding.domain_id_required");
  const normalized = domainId.trim().toLowerCase().replace(/\s+/g, "-");
  return LEGACY_DOMAIN_BINDING_ALIASES[normalized as keyof typeof LEGACY_DOMAIN_BINDING_ALIASES] ?? normalized;
}

function extractDomainBindingId(source: unknown): string | null {
  if (source == null || typeof source !== "object") {
    return null;
  }
  if (Array.isArray(source)) {
    for (const item of source) {
      const candidate = extractDomainBindingId(item);
      if (candidate != null) {
        return candidate;
      }
    }
    return null;
  }
  const record = source as Record<string, unknown>;
  for (const field of DOMAIN_BINDING_FIELD_NAMES) {
    const candidate = record[field];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return normalizeDomainBindingId(candidate);
    }
  }
  for (const value of Object.values(record)) {
    const candidate = extractDomainBindingId(value);
    if (candidate != null) {
      return candidate;
    }
  }
  return null;
}

function extractDomainBindingIdFromRef(ref: string | undefined): string | null {
  if (ref == null || ref.trim().length === 0) {
    return null;
  }
  const trimmed = ref.trim();
  if (trimmed.startsWith("constraint_pack:")) {
    const segments = trimmed.split(":");
    if (segments[1] != null && segments[1].trim().length > 0) {
      return normalizeDomainBindingId(segments[1]);
    }
  }
  return normalizeDomainBindingId(trimmed);
}

export function resolveDomainBindingId(input: {
  explicit?: string;
  sources?: readonly unknown[];
  refCandidate?: string;
  errorCode: string;
  errorMessage: string;
}): string {
  if (input.explicit != null && input.explicit.trim().length > 0) {
    return normalizeDomainBindingId(input.explicit);
  }
  for (const source of input.sources ?? []) {
    const candidate = extractDomainBindingId(source);
    if (candidate != null) {
      return candidate;
    }
  }
  const refCandidate = extractDomainBindingIdFromRef(input.refCandidate);
  if (refCandidate != null) {
    return refCandidate;
  }
  throw new ValidationError(input.errorCode, input.errorMessage);
}

export function createTaskDraft(input: {
  tenantId: string;
  principal: PrincipalRef;
  source: TaskInputSource;
  domainId?: string;
  normalizedIntent: JsonValue;
  riskPreview: RiskPreview;
  taskDraftId?: string;
  rawInputRef?: ArtifactRef;
  missingFields?: readonly string[];
  ambiguityPolicy?: AmbiguityPolicy;
  createdAt?: string;
  expiresAt?: string;
}): TaskDraft {
  requireNonEmpty(input.tenantId, "task_draft.tenant_id_required");
  const domainId = resolveDomainBindingId({
    ...(input.domainId != null && input.domainId.trim().length > 0 ? { explicit: input.domainId } : {}),
    sources: [input.normalizedIntent],
    errorCode: "task_draft.domain_id_required",
    errorMessage: "task_draft.domain_id_required: TaskDraft requires a domainId or a legacy domain/division binding in normalizedIntent.",
  });
  return {
    taskDraftId: input.taskDraftId ?? newId("taskdraft"),
    tenantId: input.tenantId,
    principal: input.principal,
    source: input.source,
    ...(input.rawInputRef != null ? { rawInputRef: input.rawInputRef } : {}),
    domainId,
    normalizedIntent: input.normalizedIntent,
    missingFields: input.missingFields ?? [],
    riskPreview: input.riskPreview,
    ambiguityPolicy: input.ambiguityPolicy ?? "require_confirmation",
    createdAt: input.createdAt ?? nowIso(),
    ...(input.expiresAt != null ? { expiresAt: input.expiresAt } : {}),
  };
}

export function createConfirmedTaskSpec(input: {
  taskDraftId: string;
  tenantId: string;
  principal: PrincipalRef;
  domainId?: string;
  goal: string;
  inputs: JsonValue;
  constraintPackRef: string;
  riskClass: RiskClass;
  idempotencyKey: string;
  traceId: string;
  confirmedTaskSpecId?: string;
  confirmationReceipt?: UserConfirmationReceipt;
  createdAt?: string;
  missionRef?: MissionRef;
  missionSnapshotRef?: string;
}): ConfirmedTaskSpec {
  requireNonEmpty(input.goal, "confirmed_task_spec.goal_required");
  requireNonEmpty(input.constraintPackRef, "confirmed_task_spec.constraint_pack_required");
  if (isHighRisk(input.riskClass) && input.confirmationReceipt == null) {
    throw new ValidationError(
      "confirmed_task_spec.confirmation_required",
      "confirmed_task_spec.confirmation_required: High and critical task specs require a confirmation receipt.",
    );
  }
  const domainId = resolveDomainBindingId({
    ...(input.domainId != null && input.domainId.trim().length > 0 ? { explicit: input.domainId } : {}),
    sources: [input.inputs],
    refCandidate: input.constraintPackRef,
    errorCode: "confirmed_task_spec.domain_id_required",
    errorMessage: "confirmed_task_spec.domain_id_required: ConfirmedTaskSpec requires a domainId or a legacy domain/division binding in inputs.",
  });
  return {
    confirmedTaskSpecId: input.confirmedTaskSpecId ?? newId("ctspec"),
    taskDraftId: input.taskDraftId,
    tenantId: input.tenantId,
    principal: input.principal,
    domainId,
    goal: input.goal,
    inputs: input.inputs,
    constraintPackRef: input.constraintPackRef,
    riskClass: input.riskClass,
    ...(input.confirmationReceipt != null ? { confirmationReceipt: input.confirmationReceipt } : {}),
    idempotencyKey: input.idempotencyKey,
    traceId: input.traceId,
    createdAt: input.createdAt ?? nowIso(),
    ...(input.missionRef != null ? { missionRef: input.missionRef } : {}),
    ...(input.missionSnapshotRef != null ? { missionSnapshotRef: input.missionSnapshotRef } : {}),
  };
}

export function createRequestEnvelopeFromConfirmedTask(input: {
  confirmedTaskSpec: ConfirmedTaskSpec;
  budgetIntent: BudgetIntent;
  policyContext?: JsonValue;
  artifactRefs?: readonly ArtifactRef[];
  requestId?: string;
  requestHash?: string;
  priority?: number;
  submittedAt?: string;
  sourcePlane?: string;
  targetPlane?: string;
  missionRef?: MissionRef;
  missionSnapshotRef?: string;
}): RequestEnvelope {
  const missionRef = input.missionRef ?? input.confirmedTaskSpec.missionRef;
  const missionSnapshotRef = input.missionSnapshotRef ?? input.confirmedTaskSpec.missionSnapshotRef;
  return {
    requestId: input.requestId ?? newId("request"),
    confirmedTaskSpecId: input.confirmedTaskSpec.confirmedTaskSpecId,
    tenantId: input.confirmedTaskSpec.tenantId,
    principal: input.confirmedTaskSpec.principal,
    domainId: input.confirmedTaskSpec.domainId,
    traceId: input.confirmedTaskSpec.traceId,
    idempotencyKey: input.confirmedTaskSpec.idempotencyKey,
    priority: input.priority ?? 0,
    requestHash: input.requestHash ?? newId("reqhash"),
    constraintPackRef: input.confirmedTaskSpec.constraintPackRef,
    budgetIntent: input.budgetIntent,
    policyContext: input.policyContext ?? {},
    artifactRefs: input.artifactRefs ?? [],
    submittedAt: input.submittedAt ?? nowIso(),
    ...(input.sourcePlane != null ? { sourcePlane: input.sourcePlane } : {}),
    ...(input.targetPlane != null ? { targetPlane: input.targetPlane } : {}),
    ...(missionRef != null ? { missionRef } : {}),
    ...(missionSnapshotRef != null ? { missionSnapshotRef } : {}),
  };
}
