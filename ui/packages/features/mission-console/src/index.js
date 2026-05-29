import { createFeatureModule } from "@aa/ui-core";
import { translateFeatureCopy } from "@aa/shared-i18n";
import { MissionConsoleWebView } from "./web";
const featureCopy = translateFeatureCopy("mission-console");
const missionConsoleFeature = createFeatureModule({
    id: "mission-console",
    title: featureCopy.title,
    group: "Mission Control",
    path: "/mission-control/missions",
    permission: "authenticated",
    status: "Implemented/Contracted",
    summary: featureCopy.summary,
    render: MissionConsoleWebView,
});
export default missionConsoleFeature;
export { mapMissionsToConsoleVm, useMissionConsoleVm } from "./hooks";
export { createMissionConsoleMobileCards } from "./mobile";
export { MissionConsoleWebView } from "./web";
