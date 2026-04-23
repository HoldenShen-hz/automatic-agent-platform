import { createFeatureModule } from "@aa/ui-core";
import { CostCenterWebView } from "./web";

const costCenterFeature = createFeatureModule({
  id: "cost-center",
  title: "Cost Center",
  group: "Shared",
  path: "/shared/costs",
  permission: "domain_admin+",
  status: "Planned",
  kind: "planned",
  summary: "成本中心与预算视图。",
  render: CostCenterWebView,
});

export default costCenterFeature;
export { createCostCenterMobileCards } from "./mobile";
export { mapCostReportsToVm, useCostCenterVm } from "./hooks";
export { CostCenterWebView } from "./web";
