import { createFeatureModule } from "@aa/ui-core";
import { MissionConsoleWebView } from "./web";

const missionConsoleFeature = createFeatureModule({
  id: "mission-console",
  title: "Mission Console",
  group: "Mission Control",
  path: "/mission-control/missions",
  permission: "authenticated",
  status: "Implemented/Contracted",
  summary: "Mission overview, task and run ownership, budget posture, and evidence lineage.",
  render: MissionConsoleWebView,
});

export default missionConsoleFeature;
export { mapMissionsToConsoleVm, useMissionConsoleVm } from "./hooks";
export { createMissionConsoleMobileCards } from "./mobile";
export { MissionConsoleWebView } from "./web";
