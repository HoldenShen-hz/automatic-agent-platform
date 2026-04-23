import { fetchTasks, fetchWorkflows, type RESTClient } from "@aa/shared-api-client";
import { createReadonlyQuery } from "./helpers";

export const taskQueryKeys = {
  tasks: ["tasks"] as const,
  workflows: ["workflows"] as const,
};

export function createTasksQuery(client: RESTClient) {
  return createReadonlyQuery(taskQueryKeys.tasks, () => fetchTasks(client));
}

export function createWorkflowsQuery(client: RESTClient) {
  return createReadonlyQuery(taskQueryKeys.workflows, () => fetchWorkflows(client));
}
