/**
 * Rollout Freeze Manager
 *
 * Manages global rollout freeze state triggered by error budget exhaustion.
 * This module is used by both:
 * - SloAlertingService: to set freeze when error budget is exhausted
 * - PolicyRolloutService: to check freeze before allowing rollouts
 */
import { ServiceRegistry } from "../lifecycle/service-registry.js";
export class RolloutFreezeManager {
    frozen = false;
    frozenAt = null;
    frozenBySloId = null;
    /**
     * Checks if rollouts are currently frozen.
     */
    isFrozen() {
        return this.frozen;
    }
    /**
     * Gets the current freeze state.
     */
    getState() {
        return {
            frozen: this.frozen,
            frozenAt: this.frozenAt,
            frozenBySloId: this.frozenBySloId,
        };
    }
    /**
     * Freezes rollouts due to error budget exhaustion.
     */
    freeze(sloId) {
        this.frozen = true;
        this.frozenAt = new Date().toISOString();
        this.frozenBySloId = sloId;
    }
    /**
     * Unfreezes rollouts after error budget has been restored.
     */
    unfreeze() {
        this.frozen = false;
        this.frozenAt = null;
        this.frozenBySloId = null;
    }
}
const ROLLOUT_FREEZE_MANAGER_SERVICE = "rollout-freeze-manager";
export function getRolloutFreezeManager() {
    const registry = ServiceRegistry.getInstance();
    registry.register(ROLLOUT_FREEZE_MANAGER_SERVICE, {
        init: () => new RolloutFreezeManager(),
    });
    return registry.get(ROLLOUT_FREEZE_MANAGER_SERVICE);
}
export const rolloutFreezeManager = new Proxy({}, {
    get(_target, property, receiver) {
        const value = Reflect.get(getRolloutFreezeManager(), property, receiver);
        return typeof value === "function" ? value.bind(getRolloutFreezeManager()) : value;
    },
});
//# sourceMappingURL=rollout-freeze-manager.js.map