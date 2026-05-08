import { createFeatureModule } from "@aa/ui-core";
import { SettingsWebView } from "./web";
import { lazy } from "react";

// §4.2.9: 8 sub-page routes for Settings
const LazySettingsGeneral = lazy(() => import("./sub-pages/general"));
const LazySettingsAppearance = lazy(() => import("./sub-pages/appearance"));
const LazySettingsNotifications = lazy(() => import("./sub-pages/notifications"));
const LazySettingsSecurity = lazy(() => import("./sub-pages/security"));
const LazySettingsApiKeys = lazy(() => import("./sub-pages/api-keys"));
const LazySettingsTeam = lazy(() => import("./sub-pages/team"));
const LazySettingsBilling = lazy(() => import("./sub-pages/billing"));
const LazySettingsAdvanced = lazy(() => import("./sub-pages/advanced"));

export const settingsSubPages = [
  { id: "general", path: "general", label: "General", Component: LazySettingsGeneral },
  { id: "appearance", path: "appearance", label: "Appearance", Component: LazySettingsAppearance },
  { id: "notifications", path: "notifications", label: "Notifications", Component: LazySettingsNotifications },
  { id: "security", path: "security", label: "Security", Component: LazySettingsSecurity },
  { id: "api-keys", path: "api-keys", label: "API Keys", Component: LazySettingsApiKeys },
  { id: "team", path: "team", label: "Team", Component: LazySettingsTeam },
  { id: "billing", path: "billing", label: "Billing", Component: LazySettingsBilling },
  { id: "advanced", path: "advanced", label: "Advanced", Component: LazySettingsAdvanced },
] as const;

const settingsFeature = createFeatureModule({
  id: "settings",
  title: "Settings",
  group: "Shared",
  path: "/shared/settings",
  permission: "authenticated",
  status: "Implemented/Internal",
  summary: "配置中心、偏好保存、域设置与模型配置闭环。",
  render: SettingsWebView,
  subPages: settingsSubPages,
});

export default settingsFeature;
export { createSettingsMobileCards } from "./mobile";
export { useSettingsVm } from "./hooks";
export { SettingsWebView } from "./web";
