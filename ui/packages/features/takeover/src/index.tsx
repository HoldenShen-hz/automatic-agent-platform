import { createFeatureModule } from "@aa/ui-core";
import { TakeoverWebView } from "./web";

const takeoverFeature = createFeatureModule({
  id: "takeover",
  title: "Admin Takeover Console",
  group: "Admin",
  path: "/admin/takeover",
  permission: "platform_sre",
  status: "Implemented/Internal",
  summary: "管理员接管、重试和人工覆盖入口。",
  render: TakeoverWebView,
});

export default takeoverFeature;
export { createTakeoverMobileCards } from "./mobile";
export { useTakeoverVm } from "./hooks";
export { TakeoverWebView } from "./web";
