import { createFeatureModule } from "@aa/ui-core";

export default createFeatureModule({
  id: "domain-wizard",
  title: "Domain Wizard",
  group: "Shared",
  path: "/shared/domain-wizard",
  permission: "domain_admin+",
  status: "Implemented/Internal",
  summary: "领域接入向导和 DomainUIConfig 驱动页面。",
});
