import type { MissionConsoleVm } from "../hooks";

export function createMissionConsoleMobileCards(vm: MissionConsoleVm) {
  return vm.missions.map((mission) => ({
    id: mission.missionId,
    title: mission.title,
    subtitle: `${mission.status} / ${mission.priority}`,
    evidenceCount: mission.missionId === vm.selectedMissionId ? vm.evidence.length : 0,
  }));
}
