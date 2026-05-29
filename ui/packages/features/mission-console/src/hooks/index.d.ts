import type { MissionBudgetSummaryDTO, MissionDTO, MissionMemberDTO, MissionResourceDTO } from "@aa/shared-types";
export interface MissionConsoleVm {
    readonly loading: boolean;
    readonly missions: readonly MissionDTO[];
    readonly selectedMission: MissionDTO | null;
    readonly selectedMissionId: string | null;
    readonly members: readonly MissionMemberDTO[];
    readonly tasks: readonly MissionResourceDTO[];
    readonly runs: readonly MissionResourceDTO[];
    readonly evidence: readonly MissionResourceDTO[];
    readonly knowledge: readonly MissionResourceDTO[];
    readonly learning: readonly MissionResourceDTO[];
    readonly budget: MissionBudgetSummaryDTO | null;
    readonly missionSettings: readonly {
        key: string;
        value: string;
    }[];
    readonly knowledgeLearningSummary: readonly {
        key: string;
        value: string;
    }[];
    readonly recommendedActions: readonly {
        title: string;
        description: string;
    }[];
    readonly operatorNotices: readonly {
        title: string;
        description: string;
    }[];
    selectMission(missionId: string): void;
}
export declare function mapMissionsToConsoleVm(missions: readonly MissionDTO[], selectedMissionId: string | null): {
    missions: readonly MissionDTO[];
    selectedMission: MissionDTO | null;
    selectedMissionId: string | null;
};
export declare function useMissionConsoleVm(): MissionConsoleVm;
