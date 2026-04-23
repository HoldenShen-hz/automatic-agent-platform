import { createFeatureModule } from "@aa/ui-core";
import { GovernanceComplianceWebView } from "./web";

const governanceComplianceFeature = createFeatureModule({
  id: "governance-compliance",
  title: "Governance Compliance",
  group: "Governance",
  path: "/governance/governance-overview",
  permission: "domain_admin+",
  status: "Planned",
  kind: "planned",
  summary: "治理与合规视图，通过 planned seam 对齐后端增强端点。",
  render: GovernanceComplianceWebView,
});

export default governanceComplianceFeature;
export { createGovernanceComplianceMobileCards } from "./mobile";
export { useGovernanceComplianceVm } from "./hooks";
export { GovernanceComplianceWebView } from "./web";
