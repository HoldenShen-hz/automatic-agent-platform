declare const missionConsoleFeature: import("@aa/ui-core").FeatureModule;
export default missionConsoleFeature;
export { mapMissionsToConsoleVm, useMissionConsoleVm } from "./hooks";
export { createMissionConsoleMobileCards } from "./mobile";
export { MissionConsoleWebView } from "./web";
