/**
 * Rollout Freeze Manager
 *
 * Manages global rollout freeze state triggered by error budget exhaustion.
 * This module is used by both:
 * - SloAlertingService: to set freeze when error budget is exhausted
 * - PolicyRolloutService: to check freeze before allowing rollouts
 */
export class RolloutFreezeManager {
    static frozen = false;
    static frozenAt = null;
    static frozenBySloId = null;
    /**
     * Checks if rollouts are currently frozen.
     */
    isFrozen() {
        return RolloutFreezeManager.frozen;
    }
    /**
     * Gets the current freeze state.
     */
    getState() {
        return {
            frozen: RolloutFreezeManager.frozen,
            frozenAt: RolloutFreezeManager.frozenAt,
            frozenBySloId: RolloutFreezeManager.frozenBySloId,
        };
    }
    /**
     * Freezes rollouts due to error budget exhaustion.
     */
    freeze(sloId) {
        RolloutFreezeManager.frozen = true;
        RolloutFreezeManager.frozenAt = new Date().toISOString();
        RolloutFreezeManager.frozenBySloId = sloId;
    }
    /**
     * Unfreezes rollouts after error budget has been restored.
     */
    unfreeze() {
        RolloutFreezeManager.frozen = false;
        RolloutFreezeManager.frozenAt = null;
        RolloutFreezeManager.frozenBySloId = null;
    }
}
export const rolloutFreezeManager = new RolloutFreezeManager();
//# sourceMappingURL=rollout-freeze-manager.js.map