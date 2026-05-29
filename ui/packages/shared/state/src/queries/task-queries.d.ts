import { type RESTClient } from "@aa/shared-api-client";
export declare const taskQueryKeys: {
    tasks: readonly ["tasks"];
    workflows: readonly ["workflows"];
};
export declare function createTasksQuery(client: RESTClient): {
    queryKey: readonly ["tasks"];
    queryFn: import("@tanstack/query-core").QueryFunction<readonly import("@aa/shared-types").TaskDTO[], readonly ["tasks"]>;
};
export declare function createWorkflowsQuery(client: RESTClient): {
    queryKey: readonly ["workflows"];
    queryFn: import("@tanstack/query-core").QueryFunction<readonly import("@aa/shared-types").WorkflowDTO[], readonly ["workflows"]>;
};
