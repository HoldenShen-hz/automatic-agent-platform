import { fetchTasks, fetchTasksPage, fetchWorkflows, fetchWorkflowsPage, fetchWorkflowRunSteps, type PaginationParams, type RESTClient } from "@aa/shared-api-client";
import { createCursorInfiniteQuery, createReadonlyQuery } from "./helpers";

export const taskQueryKeys = {
  tasks: ["tasks"] as const,
  workflows: ["workflows"] as const,
  workflowRunSteps: (workflowRunId: string) => ["workflow-runs", workflowRunId, "steps"] as const,
};

export function createTasksQuery(client: RESTClient) {
  return createReadonlyQuery(taskQueryKeys.tasks, () => fetchTasks(client));
}

export function createInfiniteTasksQuery(client: RESTClient, pagination?: Omit<PaginationParams, "cursor">) {
  return createCursorInfiniteQuery(taskQueryKeys.tasks, (page) => fetchTasksPage(client, page), pagination);
}

export function createWorkflowsQuery(client: RESTClient) {
  return createReadonlyQuery(taskQueryKeys.workflows, () => fetchWorkflows(client));
}

export function createInfiniteWorkflowsQuery(client: RESTClient, pagination?: Omit<PaginationParams, "cursor">) {
  return createCursorInfiniteQuery(taskQueryKeys.workflows, (page) => fetchWorkflowsPage(client, page), pagination);
}

export function createWorkflowRunStepsQuery(client: RESTClient, workflowRunId: string) {
  return createReadonlyQuery(taskQueryKeys.workflowRunSteps(workflowRunId), () => fetchWorkflowRunSteps(client, workflowRunId));
}
