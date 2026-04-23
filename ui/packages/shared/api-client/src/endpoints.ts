import type {
  AgentDTO,
  AnalyticsMetricDTO,
  ApprovalDTO,
  CostReportDTO,
  DashboardSnapshotDTO,
  ExplanationDTO,
  IncidentDTO,
  MarketplacePackDTO,
  QueueDTO,
  TaskDTO,
  UserPreferenceDTO,
  WorkerDTO,
  WorkflowDTO,
} from "@aa/shared-types";
import type { RESTClient } from "./rest-client";

export interface EndpointDefinition {
  readonly id: string;
  readonly path: string;
  readonly apiLayer: "A" | "B" | "C";
  readonly planned: boolean;
}

export const endpointCatalog = {
  dashboardSnapshot: {
    id: "dashboard.snapshot",
    path: "/dashboard/snapshot",
    apiLayer: "C",
    planned: false,
  },
  tasks: {
    id: "tasks.list",
    path: "/tasks",
    apiLayer: "C",
    planned: false,
  },
  workflows: {
    id: "workflows.list",
    path: "/workflows",
    apiLayer: "C",
    planned: false,
  },
  approvals: {
    id: "approvals.list",
    path: "/approvals",
    apiLayer: "C",
    planned: false,
  },
  incidents: {
    id: "incidents.list",
    path: "/incidents",
    apiLayer: "C",
    planned: false,
  },
  workers: {
    id: "workers.list",
    path: "/admin/workers",
    apiLayer: "B",
    planned: false,
  },
  queues: {
    id: "queues.list",
    path: "/admin/queues",
    apiLayer: "B",
    planned: false,
  },
  agents: {
    id: "agents.list",
    path: "/agents",
    apiLayer: "C",
    planned: true,
  },
  analytics: {
    id: "analytics.metrics",
    path: "/dashboard/metrics",
    apiLayer: "C",
    planned: true,
  },
  costs: {
    id: "costs.report",
    path: "/cost-reports",
    apiLayer: "C",
    planned: true,
  },
  marketplace: {
    id: "marketplace.list",
    path: "/marketplace",
    apiLayer: "C",
    planned: true,
  },
  explanations: {
    id: "explanations.list",
    path: "/explanations",
    apiLayer: "C",
    planned: true,
  },
  preferences: {
    id: "user.preferences",
    path: "/preferences",
    apiLayer: "C",
    planned: true,
  },
  workflowBuilder: {
    id: "workflow-builder",
    path: "/workflows",
    apiLayer: "C",
    planned: true,
  },
} satisfies Record<string, EndpointDefinition>;

export async function fetchDashboardSnapshot(client: RESTClient): Promise<DashboardSnapshotDTO> {
  return client.get<DashboardSnapshotDTO>(endpointCatalog.dashboardSnapshot.path);
}

export async function fetchTasks(client: RESTClient): Promise<readonly TaskDTO[]> {
  return client.get<readonly TaskDTO[]>(endpointCatalog.tasks.path);
}

export async function fetchWorkflows(client: RESTClient): Promise<readonly WorkflowDTO[]> {
  return client.get<readonly WorkflowDTO[]>(endpointCatalog.workflows.path);
}

export async function fetchApprovals(client: RESTClient): Promise<readonly ApprovalDTO[]> {
  return client.get<readonly ApprovalDTO[]>(endpointCatalog.approvals.path);
}

export async function fetchIncidents(client: RESTClient): Promise<readonly IncidentDTO[]> {
  return client.get<readonly IncidentDTO[]>(endpointCatalog.incidents.path);
}

export async function fetchWorkers(client: RESTClient): Promise<readonly WorkerDTO[]> {
  return client.get<readonly WorkerDTO[]>(endpointCatalog.workers.path);
}

export async function fetchQueues(client: RESTClient): Promise<readonly QueueDTO[]> {
  return client.get<readonly QueueDTO[]>(endpointCatalog.queues.path);
}

export async function fetchAgents(client: RESTClient): Promise<readonly AgentDTO[]> {
  return client.get<readonly AgentDTO[]>(endpointCatalog.agents.path);
}

export async function fetchAnalytics(client: RESTClient): Promise<readonly AnalyticsMetricDTO[]> {
  return client.get<readonly AnalyticsMetricDTO[]>(endpointCatalog.analytics.path);
}

export async function fetchCosts(client: RESTClient): Promise<readonly CostReportDTO[]> {
  return client.get<readonly CostReportDTO[]>(endpointCatalog.costs.path);
}

export async function fetchMarketplace(client: RESTClient): Promise<readonly MarketplacePackDTO[]> {
  return client.get<readonly MarketplacePackDTO[]>(endpointCatalog.marketplace.path);
}

export async function fetchExplanations(client: RESTClient): Promise<readonly ExplanationDTO[]> {
  return client.get<readonly ExplanationDTO[]>(endpointCatalog.explanations.path);
}

export async function fetchPreferences(client: RESTClient): Promise<UserPreferenceDTO> {
  return client.get<UserPreferenceDTO>(endpointCatalog.preferences.path);
}
