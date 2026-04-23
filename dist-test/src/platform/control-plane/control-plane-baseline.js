export const CONTROL_PLANE_CAPABILITY_BASELINES = Object.freeze([
    { capabilityId: "approval-center", entryModule: "src/platform/control-plane/approval-center/index.ts", description: "Approval orchestration and multi-party approval baselines.", baselineServices: ["ApprovalService", "ApprovalFlowEngine"] },
    { capabilityId: "audit-export", entryModule: "src/platform/control-plane/audit-export/index.ts", description: "Audit export and evidence packaging baselines.", baselineServices: ["AuditExportService"] },
    { capabilityId: "compliance", entryModule: "src/platform/control-plane/compliance/index.ts", description: "Operational compliance and erasure control baselines.", baselineServices: ["ErasureRequestService"] },
    { capabilityId: "config-center", entryModule: "src/platform/control-plane/config-center/index.ts", description: "Configuration governance, rollout, versioning, and startup validation baselines.", baselineServices: ["ConfigGovernanceService", "ConfigVersioningService"] },
    { capabilityId: "cost-alert", entryModule: "src/platform/control-plane/cost-alert/index.ts", description: "Budget alerting and threshold-based cost control baselines.", baselineServices: ["CostAlertService"] },
    { capabilityId: "iam", entryModule: "src/platform/control-plane/iam/index.ts", description: "Sandbox policy, secret management, egress governance, and IAM baselines.", baselineServices: ["SecretManagementService"] },
    { capabilityId: "incident-control", entryModule: "src/platform/control-plane/incident-control/index.ts", description: "Incident, deployment, doctor, and human takeover control baselines.", baselineServices: ["DoctorService", "ReleasePipelineService"] },
    { capabilityId: "policy-center", entryModule: "src/platform/control-plane/policy-center/index.ts", description: "Policy composition, merge, and enforcement baselines.", baselineServices: ["PolicyRegistryService"] },
    { capabilityId: "replay-repair-control", entryModule: "src/platform/control-plane/replay-repair-control/index.ts", description: "Replay, rebuild, and repair control baselines.", baselineServices: ["ReplayRepairControlService"] },
    { capabilityId: "risk-control", entryModule: "src/platform/control-plane/risk-control/index.ts", description: "Risk evaluation, stop-loss, and safety gate baselines.", baselineServices: ["RiskEvaluationEngine"] },
    { capabilityId: "rollout-controller", entryModule: "src/platform/control-plane/rollout-controller/index.ts", description: "Traffic routing, rollout, and rollout freeze baselines.", baselineServices: ["TrafficRoutingService"] },
    { capabilityId: "tenant", entryModule: "src/platform/control-plane/tenant/index.ts", description: "Tenant registration, isolation, and tenancy lifecycle baselines.", baselineServices: ["TenantManagementService"] },
]);
export function listControlPlaneCapabilityBaselines() {
    return CONTROL_PLANE_CAPABILITY_BASELINES;
}
export function resolveControlPlaneCapabilityBaseline(capabilityId) {
    const baseline = CONTROL_PLANE_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
    if (baseline == null) {
        throw new Error(`control_plane_capability.not_found:${capabilityId}`);
    }
    return baseline;
}
//# sourceMappingURL=control-plane-baseline.js.map