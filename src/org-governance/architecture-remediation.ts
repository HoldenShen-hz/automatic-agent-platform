export type OrgNodeType = "company" | "division" | "department" | "team";
export type ApprovalPermissionLevel = "view" | "operate" | "admin" | "super_admin";
export type ComplianceFrameworkType = "GDPR" | "SOC2" | "PIPL" | "HIPAA" | "SOX" | "PCI_DSS";
export type KnowledgeAccessPolicy = "strict" | "controlled";

export interface CanonicalOrgNode {
  readonly nodeId: string;
  readonly type: OrgNodeType;
  readonly name: string;
}

export interface LegalEntityBoundary {
  readonly boundaryId: string;
  readonly legalEntityId: string;
  readonly countryCode: string;
  readonly dataResidencyPolicy: "local_only" | "approved_transfer" | "global_allowed";
  readonly approvalPolicyRef: string;
}

export interface ApprovalRouteSnapshot {
  readonly snapshotId: string;
  readonly orgVersion: string;
  readonly approverIds: readonly string[];
  readonly sodPolicyRef: string;
  readonly conflictOfInterestRef: string;
  readonly fxSnapshotRef: string;
  readonly policyVersion: string;
  readonly evidenceRefs: readonly string[];
  readonly escalationChain: readonly string[];
  readonly timeoutAutoAction: "escalate" | "reject" | "freeze";
  readonly expiresAt: string;
}

export interface ApprovalConflictInput {
  readonly requesterId: string;
  readonly approverId: string;
  readonly requesterChainIds: readonly string[];
  readonly approverChainIds: readonly string[];
  readonly budgetOwnerId?: string;
  readonly executorId?: string;
  readonly conflictOfInterestActorIds?: readonly string[];
}

export interface ComplianceFrameworkDefinition {
  readonly frameworkId: string;
  readonly type: ComplianceFrameworkType;
  readonly auditRequirements: readonly string[];
  readonly reportTemplate: string;
}

export interface KnowledgeBoundaryPolicy {
  readonly boundaryId: string;
  readonly accessPolicy: KnowledgeAccessPolicy;
  readonly auditOnAccess: boolean;
  readonly wallExpiryPolicy: "never" | "time_bound" | "compliance_reset";
  readonly coolingOffDays: number;
}

export interface DelegatedPermission {
  readonly permissionId: string;
  readonly level: ApprovalPermissionLevel;
  readonly delegatable: boolean;
  readonly expiresAt: string;
  readonly derivedFromPermissionId?: string;
}

export interface IdentitySyncDlqRecord {
  readonly recordId: string;
  readonly identityId: string;
  readonly provider: "SCIM" | "SAML2" | "OIDC";
  readonly retryCount: number;
  readonly conflictReportRef: string;
}

export function evaluateApprovalConflicts(input: ApprovalConflictInput): readonly string[] {
  const conflicts: string[] = [];
  if (input.requesterId === input.approverId) {
    conflicts.push("sod.same_actor");
  }
  if (input.requesterChainIds.some((chainId) => input.approverChainIds.includes(chainId))) {
    conflicts.push("sod.same_approval_chain");
  }
  if (input.budgetOwnerId != null && input.executorId != null && input.budgetOwnerId === input.executorId) {
    conflicts.push("sod.budget_owner_executor_conflict");
  }
  if (input.conflictOfInterestActorIds?.includes(input.approverId)) {
    conflicts.push("coi.approver_conflict");
  }
  return conflicts;
}

export function mergeDenyPolicy(parentAllows: boolean, childAllows: boolean): boolean {
  return parentAllows && childAllows;
}

export function evaluateUnknownDelegatedGuardrail(guardrailType: string): { readonly allowed: false; readonly reasonCode: string } {
  return { allowed: false, reasonCode: `delegated_governance.unknown_guardrail:${guardrailType}` };
}

export function cascadeRevokePermission(
  permissionId: string,
  permissions: readonly DelegatedPermission[],
): readonly string[] {
  const revoked = new Set<string>([permissionId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const permission of permissions) {
      if (permission.derivedFromPermissionId != null && revoked.has(permission.derivedFromPermissionId) && !revoked.has(permission.permissionId)) {
        revoked.add(permission.permissionId);
        changed = true;
      }
    }
  }
  return [...revoked].sort();
}

export function buildOrgGovernanceRemediationEvidence(): readonly string[] {
  return Array.from({ length: 24 }, (_value, index) => `O-${index + 1}`);
}
