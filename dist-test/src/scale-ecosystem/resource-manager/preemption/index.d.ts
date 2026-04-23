export interface PreemptionCandidate {
    readonly executionId: string;
    readonly priority: number;
    readonly progressPercent: number;
}
export declare function choosePreemptionVictim(candidates: readonly PreemptionCandidate[]): PreemptionCandidate | null;
