import { fetchApprovals, fetchApprovalsPage, type PaginationParams, type RESTClient } from "@aa/shared-api-client";
import { createCursorInfiniteQuery, createReadonlyQuery } from "./helpers";

export const approvalQueryKeys = {
  approvals: ["approvals"] as const,
};

export function createApprovalsQuery(client: RESTClient) {
  return createReadonlyQuery(approvalQueryKeys.approvals, () => fetchApprovals(client));
}

export function createInfiniteApprovalsQuery(client: RESTClient, pagination?: Omit<PaginationParams, "cursor">) {
  return createCursorInfiniteQuery(approvalQueryKeys.approvals, (page) => fetchApprovalsPage(client, page), pagination);
}
