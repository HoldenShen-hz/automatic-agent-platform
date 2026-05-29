import { fetchTasks, fetchWorkflows } from "@aa/shared-api-client";
import { createReadonlyQuery } from "./helpers";
export const taskQueryKeys = {
    tasks: ["tasks"],
    workflows: ["workflows"],
};
export function createTasksQuery(client) {
    return createReadonlyQuery(taskQueryKeys.tasks, () => fetchTasks(client));
}
export function createWorkflowsQuery(client) {
    return createReadonlyQuery(taskQueryKeys.workflows, () => fetchWorkflows(client));
}
