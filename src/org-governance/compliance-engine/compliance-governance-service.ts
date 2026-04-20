import { nowIso } from "../../platform/contracts/types/ids.js";
import type { OrgNode } from "../org-model/org-node/index.js";
import {
  buildGovernanceAuditRecord,
  type GovernanceAuditRecord,
} from "./audit-enforcer/index.js";
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
  readonly auditRecord: GovernanceAuditRecord;
}

export class ComplianceGovernanceService {
  public constructor(
    private readonly nodes: readonly OrgNode[],
    private readonly policiesByNodeId: Readonly<Record<string, PolicyLayer[]>>,
  ) {}

  public evaluate(input: ComplianceEvaluationInput): ComplianceEvaluationResult {
    const effectivePolicy = resolveCompliancePolicyForNode(
      this.nodes,
      input.orgNodeId,
      this.policiesByNodeId,
    );
    const requiredKeys = input.requiredPolicyKeys ?? [];
    const missingKeys = requiredKeys.filter((key) => !(key in effectivePolicy));
    const allowed = missingKeys.length === 0;

    return {
      orgNodeId: input.orgNodeId,
      effectivePolicy,
      allowed,
      missingKeys,
      auditRecord: buildGovernanceAuditRecord({
        recordId: `audit_${input.orgNodeId}_${input.action}`,
        action: input.action,
        actorId: input.actorId,
        orgNodeId: input.orgNodeId,
        allowed,
        reasonCodes: allowed ? ["compliance.policy_resolved"] : missingKeys.map((key) => `compliance.missing:${key}`),
        occurredAt: input.occurredAt ?? nowIso(),
      }),
    };
  }
}
