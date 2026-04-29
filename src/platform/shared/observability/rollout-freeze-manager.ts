/**
 * Rollout Freeze Manager
 *
 * Manages global rollout freeze state triggered by error budget exhaustion.
 * This module is used by both:
 * - SloAlertingService: to set freeze when error budget is exhausted
 * - PolicyRolloutService: to check freeze before allowing rollouts
 *
 * Supports gradient degradation per §27.6:
 * - SLOWDOWN (50-80% burn): reduced deploy rate
 * - FREEZE (80-100% burn): halt rollouts
 * - CRITICAL (>100% burn): full freeze + reliability sprint
 */

import { ServiceRegistry } from "../lifecycle/service-registry.js";

export type DegradationSeverity = "slowdown" | "freeze" | "critical";

export interface RolloutFreezeState {
  frozen: boolean;
  frozenAt: string | null;
  frozenBySloId: string | null;
  severity: DegradationSeverity | null;
  slowdownFactor: number | null;
}

export class RolloutFreezeManager {
  private frozen = false;
  private frozenAt: string | null = null;
  private frozenBySloId: string | null = null;
  private severity: DegradationSeverity | null = null;
  private slowdownFactor: number | null = null;

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
      severity: this.severity,
      slowdownFactor: this.slowdownFactor,
    };
  }

  /**
   * Sets rollout slowdown mode with a burn-rate factor.
   * @param sloId - The SLO ID that triggered the slowdown
   * @param burnRate - The burn rate (0.5-1.0 range for slowdown)
   */
  public setSlowdown(sloId: string, burnRate: number): void {
    this.frozen = false;
    this.frozenAt = new Date().toISOString();
    this.frozenBySloId = sloId;
    this.severity = "slowdown";
    this.slowdownFactor = burnRate;
  }

  /**
   * Freezes rollouts due to error budget exhaustion.
   * @param sloId - The SLO ID that triggered the freeze
   * @param severity - Optional severity level (defaults to "freeze")
   */
  public freeze(sloId: string, severity: DegradationSeverity = "freeze"): void {
    this.frozen = severity === "critical";
    this.frozenAt = new Date().toISOString();
    this.frozenBySloId = sloId;
    this.severity = severity;
    this.slowdownFactor = null;
  }

  /**
   * Unfreezes rollouts after error budget has been restored.
   */
  public unfreeze(): void {
    this.frozen = false;
    this.frozenAt = null;
    this.frozenBySloId = null;
    this.severity = null;
    this.slowdownFactor = null;
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
