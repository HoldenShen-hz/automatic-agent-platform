import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { ReleaseConsoleWebView } from "./web";
const featureCopy = translateFeatureCopy("release-console");
const releaseConsoleFeature = createFeatureModule({
    id: "release-console",
    title: featureCopy.title,
    group: "Operations",
    path: "/operations/release-console",
    permission: "authenticated",
    status: "Planned",
    summary: featureCopy.summary,
    render: ReleaseConsoleWebView,
});
export default releaseConsoleFeature;
export { createReleaseConsoleMobileCards } from "./mobile";
export { useReleaseConsoleVm } from "./hooks";
export { ReleaseConsoleWebView } from "./web";
