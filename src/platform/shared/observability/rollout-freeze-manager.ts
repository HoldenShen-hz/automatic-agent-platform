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

export class RolloutFreezeManager {
  private static frozen = false;
  private static frozenAt: string | null = null;
  private static frozenBySloId: string | null = null;

  /**
   * Checks if rollouts are currently frozen.
   */
  public isFrozen(): boolean {
    return RolloutFreezeManager.frozen;
  }

  /**
   * Gets the current freeze state.
   */
  public getState(): RolloutFreezeState {
    return {
      frozen: RolloutFreezeManager.frozen,
      frozenAt: RolloutFreezeManager.frozenAt,
      frozenBySloId: RolloutFreezeManager.frozenBySloId,
    };
  }

  /**
   * Freezes rollouts due to error budget exhaustion.
   */
  public freeze(sloId: string): void {
    RolloutFreezeManager.frozen = true;
    RolloutFreezeManager.frozenAt = new Date().toISOString();
    RolloutFreezeManager.frozenBySloId = sloId;
  }

  /**
   * Unfreezes rollouts after error budget has been restored.
   */
  public unfreeze(): void {
    RolloutFreezeManager.frozen = false;
    RolloutFreezeManager.frozenAt = null;
    RolloutFreezeManager.frozenBySloId = null;
  }
}

export const rolloutFreezeManager = new RolloutFreezeManager();
