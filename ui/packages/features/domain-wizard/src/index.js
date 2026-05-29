import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { DomainWizardWebView } from "./web";
const featureCopy = translateFeatureCopy("domain-wizard");
const domainWizardFeature = createFeatureModule({
    id: "domain-wizard",
    title: featureCopy.title,
    group: "Shared",
    path: "/shared/domain-wizard",
    permission: "domain_admin+",
    status: "Implemented/Internal",
    summary: featureCopy.summary,
    render: DomainWizardWebView,
});
export default domainWizardFeature;
export { createDomainWizardMobileCards } from "./mobile";
export { useDomainWizardVm } from "./hooks";
export { DomainWizardWebView } from "./web";
