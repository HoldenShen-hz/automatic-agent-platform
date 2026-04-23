import { createFeatureModule } from "@aa/ui-core";
import { SettingsWebView } from "./web";

const settingsFeature = createFeatureModule({
  id: "settings",
  title: "Settings",
  group: "Shared",
  path: "/shared/settings",
  permission: "authenticated",
  status: "Implemented/Partial",
  summary: "配置中心、用户偏好、域设置与模型配置入口。",
  render: SettingsWebView,
});

export default settingsFeature;
export { createSettingsMobileCards } from "./mobile";
export { useSettingsVm } from "./hooks";
export { SettingsWebView } from "./web";
