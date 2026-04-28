export type GovernanceCapabilityId =
  | "org-model"
  | "approval-routing"
  | "sso-scim"
  | "compliance-engine"
  | "knowledge-boundary"
  | "delegated-governance";

export interface GovernanceCapabilityBaseline {
  readonly capabilityId: GovernanceCapabilityId;
  readonly entryModule: string;
  readonly description: string;
  readonly architectureSections: readonly string[];
  readonly baselineServices: readonly string[];
}

function freezeGovernanceBaseline(
  baseline: GovernanceCapabilityBaseline,
): GovernanceCapabilityBaseline {
  return Object.freeze({
    ...baseline,
    architectureSections: Object.freeze([...baseline.architectureSections]),
    baselineServices: Object.freeze([...baseline.baselineServices]),
  });
}

export const GOVERNANCE_CAPABILITY_BASELINES: readonly GovernanceCapabilityBaseline[] = Object.freeze([
  freezeGovernanceBaseline({
    capabilityId: "org-model",
    entryModule: "src/org-governance/org-model/index.ts",
    description: "Five-level organizational model, HR role governance, hierarchy, and sync baselines.",
    architectureSections: ["§46"],
    baselineServices: ["HrRoleGovernanceService"],
  }),
  freezeGovernanceBaseline({
    capabilityId: "approval-routing",
    entryModule: "src/org-governance/approval-routing/index.ts",
    description: "Approval path resolution, escalation, delegation, and SoD-aware routing baselines.",
    architectureSections: ["§47"],
    baselineServices: ["ApprovalRoutingService", "OrgChartRoutingStrategy", "AmountBasedRoutingStrategy"],
  }),
  freezeGovernanceBaseline({
    capabilityId: "sso-scim",
    entryModule: "src/org-governance/sso-scim/index.ts",
    description: "OIDC, SAML, SCIM, identity sync, and group-role mapping baselines.",
    architectureSections: ["§48"],
    baselineServices: ["IdentitySyncService", "GroupRoleMappingService", "SamlService"],
  }),
  freezeGovernanceBaseline({
    capabilityId: "compliance-engine",
    entryModule: "src/org-governance/compliance-engine/index.ts",
    description: "Department and framework-aware compliance policy resolution and evidence collection.",
    architectureSections: ["§49"],
    baselineServices: ["ComplianceGovernanceService", "ComplianceEvidenceCollector"],
  }),
  freezeGovernanceBaseline({
    capabilityId: "knowledge-boundary",
    entryModule: "src/org-governance/knowledge-boundary/index.ts",
    description: "Chinese wall, controlled sharing, federation, and knowledge boundary enforcement.",
    architectureSections: ["§50"],
    baselineServices: ["KnowledgeBoundaryService", "KnowledgeFederator"],
  }),
  freezeGovernanceBaseline({
    capabilityId: "delegated-governance",
    entryModule: "src/org-governance/delegated-governance/index.ts",
    description: "Delegation registry, scoped governance, self-service governance console, and guardrails.",
    architectureSections: ["§51"],
    baselineServices: ["DelegatedGovernanceService", "SelfServiceGovernanceConsole"],
  }),
]);

export function listGovernanceCapabilityBaselines(): readonly GovernanceCapabilityBaseline[] {
  return GOVERNANCE_CAPABILITY_BASELINES;
}

export function resolveGovernanceCapabilityBaseline(capabilityId: GovernanceCapabilityId): GovernanceCapabilityBaseline {
  const baseline = GOVERNANCE_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
  if (baseline == null) {
    throw new Error(`governance_capability.not_found:${capabilityId}`);
  }
  return baseline;
}
