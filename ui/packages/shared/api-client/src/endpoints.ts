import type { ApprovalDTO, DashboardSnapshotDTO, TaskDTO, UserPreferenceDTO } from "@aa/shared-types";
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
  approvals: {
    id: "approvals.list",
    path: "/approvals",
    apiLayer: "C",
    planned: false,
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

export async function fetchApprovals(client: RESTClient): Promise<readonly ApprovalDTO[]> {
  return client.get<readonly ApprovalDTO[]>(endpointCatalog.approvals.path);
}

export async function fetchPreferences(client: RESTClient): Promise<UserPreferenceDTO> {
  return client.get<UserPreferenceDTO>(endpointCatalog.preferences.path);
}
