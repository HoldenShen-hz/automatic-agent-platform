import type { MissionBudgetSummaryDTO, MissionDTO, MissionMemberDTO, MissionResourceDTO } from "@aa/shared-types";
export type MissionConsoleActionId = "activate" | "pause" | "resume" | "freeze" | "unfreeze" | "complete" | "archive";
export interface MissionConsoleAction {
    readonly actionId: MissionConsoleActionId | null;
    readonly title: string;
    readonly description: string;
    readonly actionLabel?: string;
}
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
    readonly recommendedActions: readonly MissionConsoleAction[];
    readonly operatorNotices: readonly {
        title: string;
        description: string;
    }[];
    readonly pendingActionId: MissionConsoleActionId | null;
    readonly actionErrorMessage: string | null;
    selectMission(missionId: string): void;
    performAction(actionId: MissionConsoleActionId): Promise<void>;
}
export declare function mapMissionsToConsoleVm(missions: readonly MissionDTO[], selectedMissionId: string | null): {
    missions: readonly MissionDTO[];
    selectedMission: MissionDTO | null;
    selectedMissionId: string | null;
};
export declare function useMissionConsoleVm(): MissionConsoleVm;
