import { createFeatureModule } from "@aa/ui-core";
import { DomainWizardWebView } from "./web";

const domainWizardFeature = createFeatureModule({
  id: "domain-wizard",
  title: "Domain Wizard",
  group: "Shared",
  path: "/shared/domain-wizard",
  permission: "domain_admin+",
  status: "Implemented/Internal",
  summary: "领域接入向导和 DomainUIConfig 驱动页面。",
  render: DomainWizardWebView,
});

export default domainWizardFeature;
export { createDomainWizardMobileCards } from "./mobile";
export { useDomainWizardVm } from "./hooks";
export { DomainWizardWebView } from "./web";
