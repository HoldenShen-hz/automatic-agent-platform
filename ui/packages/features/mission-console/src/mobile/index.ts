import type { MissionConsoleVm } from "../hooks";

export function createMissionConsoleMobileCards(vm: MissionConsoleVm) {
  return vm.missions.map((mission) => ({
    id: mission.missionId,
    title: mission.title,
    subtitle: `${mission.status} / ${mission.priority} / members ${mission.missionId === vm.selectedMissionId ? vm.members.length : 0} / knowledge ${mission.missionId === vm.selectedMissionId ? vm.knowledge.length : 0} / learning ${mission.missionId === vm.selectedMissionId ? vm.learning.length : 0} / actions ${mission.missionId === vm.selectedMissionId ? vm.recommendedActions.length : 0}`,
    evidenceCount: mission.missionId === vm.selectedMissionId ? vm.evidence.length : 0,
  }));
}
