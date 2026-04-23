import { createFeatureModule } from "@aa/ui-core";
import { ComplianceWebView } from "./web";

const complianceFeature = createFeatureModule({
  id: "compliance",
  title: "Compliance",
  group: "Governance",
  path: "/governance/compliance",
  permission: "domain_admin+",
  status: "Planned",
  kind: "planned",
  summary: "标准检查、报告导出和脱敏策略的合规中心。",
  render: ComplianceWebView,
});

export default complianceFeature;
export { createComplianceMobileCards } from "./mobile";
export { useComplianceVm } from "./hooks";
export { ComplianceWebView } from "./web";
