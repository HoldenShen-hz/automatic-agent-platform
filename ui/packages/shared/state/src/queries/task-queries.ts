import { fetchTasks, fetchWorkflows, fetchWorkflowRunSteps, type RESTClient } from "@aa/shared-api-client";
import { createReadonlyQuery } from "./helpers";

export const taskQueryKeys = {
  tasks: ["tasks"] as const,
  workflows: ["workflows"] as const,
  workflowRunSteps: (workflowRunId: string) => ["workflow-runs", workflowRunId, "steps"] as const,
};

export function createTasksQuery(client: RESTClient) {
  return createReadonlyQuery(taskQueryKeys.tasks, () => fetchTasks(client));
}

export function createWorkflowsQuery(client: RESTClient) {
  return createReadonlyQuery(taskQueryKeys.workflows, () => fetchWorkflows(client));
}

export function createWorkflowRunStepsQuery(client: RESTClient, workflowRunId: string) {
  return createReadonlyQuery(taskQueryKeys.workflowRunSteps(workflowRunId), () => fetchWorkflowRunSteps(client, workflowRunId));
}
