import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { SettingsWebView } from "./web";
const featureCopy = translateFeatureCopy("settings");
const settingsFeature = createFeatureModule({
    id: "settings",
    title: featureCopy.title,
    group: "Shared",
    path: "/shared/settings",
    permission: "authenticated",
    status: "Implemented/Internal",
    summary: featureCopy.summary,
    render: SettingsWebView,
});
export default settingsFeature;
export { createSettingsMobileCards } from "./mobile";
export { useSettingsVm } from "./hooks";
export { SettingsWebView } from "./web";
