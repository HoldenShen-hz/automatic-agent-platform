import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { ComplianceWebView } from "./web";
const featureCopy = translateFeatureCopy("compliance");
const complianceFeature = createFeatureModule({
    id: "compliance",
    title: featureCopy.title,
    group: "Governance",
    path: "/governance/compliance",
    permission: "domain_admin+",
    status: "Planned",
    summary: featureCopy.summary,
    render: ComplianceWebView,
});
export default complianceFeature;
export { createComplianceMobileCards } from "./mobile";
export { useComplianceVm } from "./hooks";
export { ComplianceWebView } from "./web";
