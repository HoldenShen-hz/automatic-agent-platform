import { createFeatureModule } from "@aa/ui-core";
import { AuditWebView } from "./web";

const auditFeature = createFeatureModule({
  id: "audit",
  title: "Audit",
  group: "Governance",
  path: "/governance/audit",
  permission: "org_admin+",
  status: "Implemented/Contracted",
  summary: "审计日志、变更追踪与合规导出入口。",
  render: AuditWebView,
});

export default auditFeature;
export { createAuditMobileCards } from "./mobile";
export { useAuditVm } from "./hooks";
export { AuditWebView } from "./web";
