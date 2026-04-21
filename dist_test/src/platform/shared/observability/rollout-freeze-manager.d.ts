/**
 * Rollout Freeze Manager
 *
 * Manages global rollout freeze state triggered by error budget exhaustion.
 * This module is used by both:
 * - SloAlertingService: to set freeze when error budget is exhausted
 * - PolicyRolloutService: to check freeze before allowing rollouts
 */
export interface RolloutFreezeState {
    frozen: boolean;
    frozenAt: string | null;
    frozenBySloId: string | null;
}
export declare class RolloutFreezeManager {
    private static frozen;
    private static frozenAt;
    private static frozenBySloId;
    /**
     * Checks if rollouts are currently frozen.
     */
    isFrozen(): boolean;
    /**
     * Gets the current freeze state.
     */
    getState(): RolloutFreezeState;
    /**
     * Freezes rollouts due to error budget exhaustion.
     */
    freeze(sloId: string): void;
    /**
     * Unfreezes rollouts after error budget has been restored.
     */
    unfreeze(): void;
}
export declare const rolloutFreezeManager: RolloutFreezeManager;
