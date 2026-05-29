import type { AgentDTO, AnalyticsMetricDTO, ApprovalDTO, CostReportDTO, DashboardSnapshotDTO, DomainConfigDTO, ExplanationDTO, FeatureFlagDTO, IncidentDTO, MarketplacePackDTO, ModelConfigDTO, QueueDTO, RoleDTO, SystemConfigDTO, TaskDTO, TenantDTO, UserDTO, UserPreferenceDTO, WebhookDTO, WorkerDTO, WorkflowRunStepDTO, WorkflowDTO } from "@aa/shared-types";
export interface MockApiShape {
    readonly dashboard: DashboardSnapshotDTO;
    readonly tasks: readonly TaskDTO[];
    readonly workflowRunSteps: Readonly<Record<string, readonly WorkflowRunStepDTO[]>>;
    readonly workflows: readonly WorkflowDTO[];
    readonly approvals: readonly ApprovalDTO[];
    readonly incidents: readonly IncidentDTO[];
    readonly workers: readonly WorkerDTO[];
    readonly queues: readonly QueueDTO[];
    readonly agents: readonly AgentDTO[];
    readonly analytics: readonly AnalyticsMetricDTO[];
    readonly costs: readonly CostReportDTO[];
    readonly marketplace: readonly MarketplacePackDTO[];
    readonly explanations: readonly ExplanationDTO[];
    readonly roles: readonly RoleDTO[];
    readonly featureFlags: readonly FeatureFlagDTO[];
    readonly models: readonly ModelConfigDTO[];
    readonly domainConfigs: readonly DomainConfigDTO[];
    readonly tenants: readonly TenantDTO[];
    readonly webhooks: readonly WebhookDTO[];
    readonly users: readonly UserDTO[];
    readonly systemConfig: SystemConfigDTO;
    readonly preferences: UserPreferenceDTO;
}
export declare const defaultMockApiShape: MockApiShape;
