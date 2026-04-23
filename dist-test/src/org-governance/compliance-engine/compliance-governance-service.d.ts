import type { OrgNode } from "../org-model/org-node/index.js";
import { type ComplianceFramework, type DepartmentComplianceBinding } from "./framework-catalog.js";
import { type GovernanceAuditRecord } from "./audit-enforcer/index.js";
import { type ComplianceEvidenceRecord } from "./evidence-collector.js";
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
    readonly applicableFrameworks: readonly ComplianceFramework[];
    readonly missingControls: readonly string[];
    readonly auditRecord: GovernanceAuditRecord;
}
export declare class ComplianceGovernanceService {
    private readonly nodes;
    private readonly policiesByNodeId;
    private readonly frameworks;
    private readonly bindings;
    private readonly evidenceCollector;
    constructor(nodes: readonly OrgNode[], policiesByNodeId: Readonly<Record<string, PolicyLayer[]>>, frameworks?: readonly ComplianceFramework[], bindings?: readonly DepartmentComplianceBinding[]);
    registerFramework(framework: ComplianceFramework): ComplianceFramework;
    attachFrameworks(binding: DepartmentComplianceBinding): DepartmentComplianceBinding;
    collectEvidence(input: Omit<ComplianceEvidenceRecord, "evidenceId" | "collectedAt"> & {
        collectedAt?: string;
    }): ComplianceEvidenceRecord;
    listEvidence(frameworkId?: string): ComplianceEvidenceRecord[];
    evaluate(input: ComplianceEvaluationInput): ComplianceEvaluationResult;
    listFrameworks(): ComplianceFramework[];
    private resolveFrameworks;
}
