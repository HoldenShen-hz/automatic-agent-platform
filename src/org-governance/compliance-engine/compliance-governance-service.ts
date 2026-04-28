import { nowIso } from "../../platform/contracts/types/ids.js";
import type { OrgNode } from "../org-model/org-node/index.js";
import {
  DEFAULT_COMPLIANCE_FRAMEWORKS,
  type ComplianceFramework,
  type DepartmentComplianceBinding,
} from "./framework-catalog.js";
import {
  buildGovernanceAuditRecord,
  type GovernanceAuditRecord,
} from "./audit-enforcer/index.js";
import { ComplianceEvidenceCollector, type ComplianceEvidenceRecord } from "./evidence-collector.js";
import type { PolicyLayer } from "./inheritance/index.js";
import { resolveCompliancePolicyForNode } from "./policy-resolver/index.js";

export interface ComplianceEvaluationInput {
  readonly actorId: string;
  readonly orgNodeId: string;
  readonly action: string;
  readonly requiredPolicyKeys?: readonly string[];
  readonly occurredAt?: string;
}

export interface ComplianceEvaluationResult {
  readonly orgNodeId: string;
  readonly effectivePolicy: Record<string, unknown>;
  readonly allowed: boolean;
  readonly missingKeys: readonly string[];
  readonly applicableFrameworks: readonly ComplianceFramework[];
  readonly missingControls: readonly string[];
  readonly auditRecord: GovernanceAuditRecord;
}

export interface ComplianceExceptionWorkflow {
  readonly exceptionId: string;
  readonly scope: string;
  readonly expiresAt: string;
  readonly approver: string;
  readonly compensatingControls: readonly string[];
  readonly auditRef: string;
}

export interface EvidenceQualityScore {
  readonly frameworkId: string;
  readonly score: number;
  readonly missingEvidenceIds: readonly string[];
}

export interface ControlCoverageReport {
  readonly frameworkId: string;
  readonly coveredControlIds: readonly string[];
  readonly missingControlIds: readonly string[];
  readonly coverageRatio: number;
}

export class ComplianceGovernanceService {
  private readonly frameworks = new Map<string, ComplianceFramework>();
  private readonly bindings = new Map<string, DepartmentComplianceBinding[]>();
  private readonly evidenceCollector = new ComplianceEvidenceCollector();

  public constructor(
    private readonly nodes: readonly OrgNode[],
    private readonly policiesByNodeId: Readonly<Record<string, PolicyLayer[]>>,
    frameworks: readonly ComplianceFramework[] = DEFAULT_COMPLIANCE_FRAMEWORKS,
    bindings: readonly DepartmentComplianceBinding[] = [],
  ) {
    for (const framework of frameworks) {
      this.frameworks.set(framework.frameworkId, framework);
    }
    for (const binding of bindings) {
      this.attachFrameworks(binding);
    }
  }

  public registerFramework(framework: ComplianceFramework): ComplianceFramework {
    this.frameworks.set(framework.frameworkId, framework);
    return framework;
  }

  public attachFrameworks(binding: DepartmentComplianceBinding): DepartmentComplianceBinding {
    this.bindings.set(binding.orgNodeId, [...(this.bindings.get(binding.orgNodeId) ?? []), binding]);
    return binding;
  }

  public collectEvidence(
    input: Omit<ComplianceEvidenceRecord, "evidenceId" | "collectedAt"> & { collectedAt?: string },
  ): ComplianceEvidenceRecord {
    return this.evidenceCollector.collect(input);
  }

  public listEvidence(frameworkId?: string): ComplianceEvidenceRecord[] {
    return this.evidenceCollector.list(frameworkId);
  }

  public createExceptionWorkflow(input: {
    readonly scope: string;
    readonly expiresAt: string;
    readonly approver: string;
    readonly compensatingControls: readonly string[];
    readonly auditRef: string;
  }): ComplianceExceptionWorkflow {
    return {
      exceptionId: `compliance_exception:${input.scope}:${input.expiresAt}`,
      scope: input.scope,
      expiresAt: input.expiresAt,
      approver: input.approver,
      compensatingControls: [...input.compensatingControls],
      auditRef: input.auditRef,
    };
  }

  public scoreEvidenceQuality(frameworkId: string): EvidenceQualityScore {
    const evidence = this.listEvidence(frameworkId);
    const missingEvidenceIds = evidence
      .filter((item) => item.artifactRef.trim().length === 0 || item.source.trim().length === 0)
      .map((item) => item.evidenceId);
    const score = evidence.length === 0
      ? 0
      : Number((((evidence.length - missingEvidenceIds.length) / evidence.length) * 100).toFixed(2));
    return {
      frameworkId,
      score,
      missingEvidenceIds,
    };
  }

  public buildControlCoverageReport(frameworkId: string, orgNodeId: string): ControlCoverageReport {
    const framework = this.frameworks.get(frameworkId);
    if (framework == null) {
      return {
        frameworkId,
        coveredControlIds: [],
        missingControlIds: [],
        coverageRatio: 0,
      };
    }
    const effectivePolicy = resolveCompliancePolicyForNode(this.nodes, orgNodeId, this.policiesByNodeId);
    const coveredControlIds = framework.controlIds.filter((controlId) => controlId in effectivePolicy);
    const missingControlIds = framework.controlIds.filter((controlId) => !coveredControlIds.includes(controlId));
    return {
      frameworkId,
      coveredControlIds,
      missingControlIds,
      coverageRatio: framework.controlIds.length === 0
        ? 1
        : Number((coveredControlIds.length / framework.controlIds.length).toFixed(4)),
    };
  }

  public evaluate(input: ComplianceEvaluationInput): ComplianceEvaluationResult {
    const effectivePolicy = resolveCompliancePolicyForNode(
      this.nodes,
      input.orgNodeId,
      this.policiesByNodeId,
    );
    const requiredKeys = input.requiredPolicyKeys ?? [];
    const missingKeys = requiredKeys.filter((key) => !(key in effectivePolicy));
    const applicableFrameworks = this.resolveFrameworks(input.orgNodeId);
    const missingControls = applicableFrameworks.flatMap((framework) =>
      framework.controlIds.filter((controlId) => !(controlId in effectivePolicy)),
    );
    const missingFrameworkPolicies = applicableFrameworks.flatMap((framework) =>
      Object.entries(framework.minimumPolicies)
        .filter(([key, value]) => !matchesFrameworkRequirement(effectivePolicy[key], value))
        .map(([key]) => key),
    );
    const allowed = missingKeys.length === 0 && missingControls.length === 0 && missingFrameworkPolicies.length === 0;

    return {
      orgNodeId: input.orgNodeId,
      effectivePolicy,
      allowed,
      missingKeys,
      applicableFrameworks,
      missingControls: [...new Set([...missingControls, ...missingFrameworkPolicies])],
      auditRecord: buildGovernanceAuditRecord({
        recordId: `audit_${input.orgNodeId}_${input.action}`,
        action: input.action,
        actorId: input.actorId,
        orgNodeId: input.orgNodeId,
        allowed,
        reasonCodes: allowed
          ? ["compliance.policy_resolved"]
          : [
            ...missingKeys.map((key) => `compliance.missing:${key}`),
            ...missingControls.map((controlId) => `compliance.control_missing:${controlId}`),
            ...missingFrameworkPolicies.map((key) => `compliance.framework_policy_missing:${key}`),
          ],
        occurredAt: input.occurredAt ?? nowIso(),
      }),
    };
  }

  public listFrameworks(): ComplianceFramework[] {
    return [...this.frameworks.values()];
  }

  private resolveFrameworks(orgNodeId: string): ComplianceFramework[] {
    const lineage = new Set<string>();
    let current = this.nodes.find((item) => item.orgNodeId === orgNodeId) ?? null;
    while (current != null) {
      lineage.add(current.orgNodeId);
      current = current.parentOrgNodeId == null
        ? null
        : this.nodes.find((item) => item.orgNodeId === current?.parentOrgNodeId) ?? null;
    }
    const frameworkIds = [...lineage]
      .flatMap((nodeId) => this.bindings.get(nodeId) ?? [])
      .flatMap((binding) => binding.frameworkIds);
    return [...new Set(frameworkIds)]
      .map((frameworkId) => this.frameworks.get(frameworkId))
      .filter((item): item is ComplianceFramework => item != null);
  }
}

function matchesFrameworkRequirement(observed: unknown, required: unknown): boolean {
  if (typeof required === "boolean") {
    return observed === required;
  }
  if (typeof required === "number") {
    return typeof observed === "number" && observed >= required;
  }
  if (typeof required === "string") {
    return observed === required;
  }
  return observed != null;
}
