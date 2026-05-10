import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { AuditWebView } from "./web";

const featureCopy = translateFeatureCopy("audit");

const auditFeature = createFeatureModule({
  id: "audit",
  title: featureCopy.title,
  group: "Governance",
  path: "/governance/audit",
  permission: "org_admin+",
  status: "Implemented/Contracted",
  summary: featureCopy.summary,
  render: AuditWebView,
});

export default auditFeature;
export { createAuditMobileCards } from "./mobile";
export { useAuditVm } from "./hooks";
export { AuditWebView } from "./web";
