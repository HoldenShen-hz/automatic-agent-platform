declare const approvalFeature: import("@aa/ui-core").FeatureModule;
export default approvalFeature;
export { createApprovalMobileCards } from "./mobile";
export { mapApprovalsToVm, useApprovalCenterVm } from "./hooks";
export { ApprovalWebView } from "./web";
