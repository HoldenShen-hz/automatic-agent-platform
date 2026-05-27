import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { CostCenterWebView } from "./web";

const featureCopy = translateFeatureCopy("cost-center");

const costCenterFeature = createFeatureModule({
  id: "cost-center",
  title: featureCopy.title,
  group: "Shared",
  path: "/shared/costs",
  permission: "domain_admin+",
  status: "Planned",
  summary: featureCopy.summary,
  render: CostCenterWebView,
});

export default costCenterFeature;
export { createCostCenterMobileCards } from "./mobile";
export { mapCostReportsToVm, useCostCenterVm } from "./hooks";
export { CostCenterWebView } from "./web";
