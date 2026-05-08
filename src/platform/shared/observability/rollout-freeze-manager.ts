/**
 * Rollout Freeze Manager
 *
 * Manages global rollout freeze state triggered by error budget exhaustion.
 * This module is used by both:
 * - SloAlertingService: to set freeze when error budget is exhausted
 * - PolicyRolloutService: to check freeze before allowing rollouts
 */

import { ServiceRegistry } from "../lifecycle/service-registry.js";

export interface RolloutFreezeState {
  frozen: boolean;
  frozenAt: string | null;
  frozenBySloId: string | null;
}

export class RolloutFreezeManager {
  private frozen = false;
  private frozenAt: string | null = null;
  private frozenBySloId: string | null = null;

  /**
   * Checks if rollouts are currently frozen.
   */
  public isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * Gets the current freeze state.
   */
  public getState(): RolloutFreezeState {
    return {
      frozen: this.frozen,
      frozenAt: this.frozenAt,
      frozenBySloId: this.frozenBySloId,
    };
  }

  /**
   * Freezes rollouts due to error budget exhaustion.
   */
  public freeze(sloId: string): void {
    this.frozen = true;
    this.frozenAt = new Date().toISOString();
    this.frozenBySloId = sloId;
  }

  /**
   * Unfreezes rollouts after error budget has been restored.
   */
  public unfreeze(): void {
    this.frozen = false;
    this.frozenAt = null;
    this.frozenBySloId = null;
  }
}

const ROLLOUT_FREEZE_MANAGER_SERVICE = "rollout-freeze-manager";

export function getRolloutFreezeManager(): RolloutFreezeManager {
  const registry = ServiceRegistry.getInstance();
  try {
    return registry.get<RolloutFreezeManager>(ROLLOUT_FREEZE_MANAGER_SERVICE);
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("service_registry.not_registered")) {
      throw err;
    }
    registry.register(ROLLOUT_FREEZE_MANAGER_SERVICE, {
      init: () => new RolloutFreezeManager(),
    });
    return registry.get<RolloutFreezeManager>(ROLLOUT_FREEZE_MANAGER_SERVICE);
  }
}

export const rolloutFreezeManager: RolloutFreezeManager = new Proxy({} as RolloutFreezeManager, {
  get(_target, property, receiver) {
    const value = Reflect.get(getRolloutFreezeManager(), property, receiver);
    return typeof value === "function" ? value.bind(getRolloutFreezeManager()) : value;
  },
});
