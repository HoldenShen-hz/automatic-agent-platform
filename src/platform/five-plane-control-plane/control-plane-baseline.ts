export type ControlPlaneCapabilityId =
  | "approval-center"
  | "audit-export"
  | "compliance"
  | "config-center"
  | "cost-alert"
  | "iam"
  | "incident-control"
  | "policy-center"
  | "replay-repair-control"
  | "risk-control"
  | "rollout-controller"
  | "tenant";

export interface ControlPlaneCapabilityBaseline {
  readonly capabilityId: ControlPlaneCapabilityId;
  readonly entryModule: string;
  readonly description: string;
  readonly baselineServices: readonly string[];
}

function freezeBaseline(
  baseline: ControlPlaneCapabilityBaseline,
): ControlPlaneCapabilityBaseline {
  return Object.freeze({
    ...baseline,
    baselineServices: Object.freeze([...baseline.baselineServices]),
  });
}

export const CONTROL_PLANE_CAPABILITY_BASELINES: readonly ControlPlaneCapabilityBaseline[] = Object.freeze([
  freezeBaseline({ capabilityId: "approval-center", entryModule: "src/platform/control-plane/approval-center/index.ts", description: "Approval orchestration and multi-party approval baselines.", baselineServices: ["ApprovalService", "ApprovalFlowEngine"] }),
  freezeBaseline({ capabilityId: "audit-export", entryModule: "src/platform/control-plane/audit-export/index.ts", description: "Audit export and evidence packaging baselines.", baselineServices: ["AuditExportService"] }),
  freezeBaseline({ capabilityId: "compliance", entryModule: "src/platform/control-plane/compliance/index.ts", description: "Operational compliance and erasure control baselines.", baselineServices: ["ErasureRequestService"] }),
  freezeBaseline({ capabilityId: "config-center", entryModule: "src/platform/control-plane/config-center/index.ts", description: "Configuration governance, rollout, versioning, and startup validation baselines.", baselineServices: ["ConfigGovernanceService", "ConfigVersioningService"] }),
  freezeBaseline({ capabilityId: "cost-alert", entryModule: "src/platform/control-plane/cost-alert/index.ts", description: "Budget alerting and threshold-based cost control baselines.", baselineServices: ["CostAlertService"] }),
  freezeBaseline({ capabilityId: "iam", entryModule: "src/platform/control-plane/iam/index.ts", description: "Sandbox policy, secret management, egress governance, and IAM baselines.", baselineServices: ["SecretManagementService"] }),
  freezeBaseline({ capabilityId: "incident-control", entryModule: "src/platform/control-plane/incident-control/index.ts", description: "Incident, deployment, doctor, and human takeover control baselines.", baselineServices: ["DoctorService", "ReleasePipelineService"] }),
  freezeBaseline({ capabilityId: "policy-center", entryModule: "src/platform/control-plane/policy-center/index.ts", description: "Policy composition, merge, and enforcement baselines.", baselineServices: ["PolicyRegistryService"] }),
  freezeBaseline({ capabilityId: "replay-repair-control", entryModule: "src/platform/control-plane/replay-repair-control/index.ts", description: "Replay, rebuild, and repair control baselines.", baselineServices: ["ReplayRepairControlService"] }),
  freezeBaseline({ capabilityId: "risk-control", entryModule: "src/platform/control-plane/risk-control/index.ts", description: "Risk evaluation, stop-loss, and safety gate baselines.", baselineServices: ["RiskEvaluationEngine"] }),
  freezeBaseline({ capabilityId: "rollout-controller", entryModule: "src/platform/control-plane/rollout-controller/index.ts", description: "Traffic routing, rollout, and rollout freeze baselines.", baselineServices: ["TrafficRoutingService"] }),
  freezeBaseline({ capabilityId: "tenant", entryModule: "src/platform/control-plane/tenant/index.ts", description: "Tenant registration, isolation, and tenancy lifecycle baselines.", baselineServices: ["TenantManagementService"] }),
]);

export function listControlPlaneCapabilityBaselines(): readonly ControlPlaneCapabilityBaseline[] {
  return CONTROL_PLANE_CAPABILITY_BASELINES;
}

export function resolveControlPlaneCapabilityBaseline(capabilityId: ControlPlaneCapabilityId): ControlPlaneCapabilityBaseline {
  const baseline = CONTROL_PLANE_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
  if (baseline == null) {
    throw new Error(`control_plane_capability.not_found:${capabilityId}`);
  }
  return baseline;
}
