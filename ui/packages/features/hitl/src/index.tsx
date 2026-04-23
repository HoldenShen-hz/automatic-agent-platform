import { createFeatureModule } from "@aa/ui-core";
import { HitlWebView } from "./web";

const hitlFeature = createFeatureModule({
  id: "hitl",
  title: "HITL",
  group: "Extended",
  path: "/extended/hitl",
  permission: "authenticated",
  status: "Implemented/Partial",
  summary: "人工介入、Inspect、Takeover、Resume 的统一入口。",
  render: HitlWebView,
});

export default hitlFeature;
export { createHitlMobileCards } from "./mobile";
export { useHitlVm } from "./hooks";
export { HitlWebView } from "./web";
