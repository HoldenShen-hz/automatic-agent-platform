import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { ApprovalWebView } from "./web";

const featureCopy = translateFeatureCopy("approval");

const approvalFeature = createFeatureModule({
  id: "approval",
  title: featureCopy.title,
  group: "Mission Control",
  path: "/mission-control/approvals",
  permission: "authenticated",
  status: "Implemented/Contracted",
  summary: featureCopy.summary,
  render: ApprovalWebView,
});

export default approvalFeature;
export { createApprovalMobileCards } from "./mobile";
export { mapApprovalsToVm, useApprovalCenterVm } from "./hooks";
export { ApprovalWebView } from "./web";
