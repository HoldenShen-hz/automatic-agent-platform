import { fetchApprovals } from "@aa/shared-api-client";
import { createReadonlyQuery } from "./helpers";
export const approvalQueryKeys = {
    approvals: ["approvals"],
};
export function createApprovalsQuery(client) {
    return createReadonlyQuery(approvalQueryKeys.approvals, () => fetchApprovals(client));
}
