import { type RESTClient } from "@aa/shared-api-client";
export declare const approvalQueryKeys: {
    approvals: readonly ["approvals"];
};
export declare function createApprovalsQuery(client: RESTClient): {
    queryKey: readonly ["approvals"];
    queryFn: import("@tanstack/query-core").QueryFunction<readonly import("@aa/shared-types").ApprovalDTO[], readonly ["approvals"]>;
};
