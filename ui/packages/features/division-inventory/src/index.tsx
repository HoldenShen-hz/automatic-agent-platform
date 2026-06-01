import { createFeatureModule } from "@aa/ui-core";
import { DivisionInventoryWebView } from "./web";

const divisionInventoryFeature = createFeatureModule({
  id: "division-inventory",
  title: "Division Inventory",
  group: "Governance",
  path: "/governance/division-inventory",
  permission: "authenticated",
  status: "Implemented/Partial",
  summary: "Read-only division governance inventory",
  render: () => <DivisionInventoryWebView />,
});

export default divisionInventoryFeature;
export { DivisionInventoryWebView } from "./web";
export { useDivisionInventoryVm } from "./hooks";
