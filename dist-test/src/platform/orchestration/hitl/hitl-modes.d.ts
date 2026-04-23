export declare const HITL_MODES: readonly ["single_approval", "multi_party_approval", "delegated_approval", "iterative_feedback", "collaborative_edit", "informed_confirmation", "circuit_breaker_human"];
export type HitlMode = typeof HITL_MODES[number];
export interface HitlModeConstraint {
    readonly mode: HitlMode;
    readonly summary: string;
}
export declare function validateHitlModeRequest(input: {
    readonly mode: HitlMode;
    readonly options: readonly {
        optionId: string;
    }[];
    readonly riskLevel: "low" | "medium" | "high" | "critical";
    readonly timeoutPolicy: "reject" | "approve" | "remain_pending";
    readonly context?: Record<string, unknown>;
}): HitlModeConstraint;
