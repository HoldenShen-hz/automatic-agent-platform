import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { GovernanceComplianceWebView } from "./web";

const featureCopy = translateFeatureCopy("governance-compliance");

const governanceComplianceFeature = createFeatureModule({
  id: "governance-compliance",
  title: featureCopy.title,
  group: "Governance",
  path: "/governance/governance-overview",
  permission: "domain_admin+",
  status: "Planned",
  summary: featureCopy.summary,
  render: GovernanceComplianceWebView,
});

export default governanceComplianceFeature;
export { createGovernanceComplianceMobileCards } from "./mobile";
export { useGovernanceComplianceVm } from "./hooks";
export { GovernanceComplianceWebView } from "./web";
