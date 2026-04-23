import { createFeatureModule } from "@aa/ui-core";
import { PolicyWebView } from "./web";

const policyFeature = createFeatureModule({
  id: "policy",
  title: "Policy",
  group: "Governance",
  path: "/governance/policy",
  permission: "domain_admin+",
  status: "Implemented/Contracted",
  summary: "治理策略、准入规则与审批策略矩阵。",
  render: PolicyWebView,
});

export default policyFeature;
export { createPolicyMobileCards } from "./mobile";
export { usePolicyVm } from "./hooks";
export { PolicyWebView } from "./web";
