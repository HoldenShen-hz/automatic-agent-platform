import type { OrgNode } from "../org-model/org-node/index.js";
import { type GovernanceAuditRecord } from "./audit-enforcer/index.js";
import type { PolicyLayer } from "./inheritance/index.js";
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
export declare class ComplianceGovernanceService {
    private readonly nodes;
    private readonly policiesByNodeId;
    constructor(nodes: readonly OrgNode[], policiesByNodeId: Readonly<Record<string, PolicyLayer[]>>);
    evaluate(input: ComplianceEvaluationInput): ComplianceEvaluationResult;
}
