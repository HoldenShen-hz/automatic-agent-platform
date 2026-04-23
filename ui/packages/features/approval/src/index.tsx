import { createFeatureModule } from "@aa/ui-core";
import { ApprovalWebView } from "./web";

const approvalFeature = createFeatureModule({
  id: "approval",
  title: "Approval Center",
  group: "Mission Control",
  path: "/mission-control/approvals",
  permission: "authenticated",
  status: "Implemented/Contracted",
  summary: "审批中心，支持风险摘要和人工决策入口。",
  render: ApprovalWebView,
});

export default approvalFeature;
export { createApprovalMobileCards } from "./mobile";
export { mapApprovalsToVm, useApprovalCenterVm } from "./hooks";
export { ApprovalWebView } from "./web";
