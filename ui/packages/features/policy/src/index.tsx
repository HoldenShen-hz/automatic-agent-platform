import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { PolicyWebView } from "./web";

const featureCopy = translateFeatureCopy("policy");

const policyFeature = createFeatureModule({
  id: "policy",
  title: featureCopy.title,
  group: "Governance",
  path: "/governance/policy",
  permission: "domain_admin+",
  status: "Planned",
  summary: featureCopy.summary,
  render: PolicyWebView,
});

export default policyFeature;
export { createPolicyMobileCards } from "./mobile";
export { usePolicyVm } from "./hooks";
export { PolicyWebView } from "./web";
