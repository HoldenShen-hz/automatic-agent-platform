import { fetchApprovals, type RESTClient } from "@aa/shared-api-client";
import { createReadonlyQuery } from "./helpers";

export const approvalQueryKeys = {
  approvals: ["approvals"] as const,
};

export function createApprovalsQuery(client: RESTClient) {
  return createReadonlyQuery(approvalQueryKeys.approvals, () => fetchApprovals(client));
}
