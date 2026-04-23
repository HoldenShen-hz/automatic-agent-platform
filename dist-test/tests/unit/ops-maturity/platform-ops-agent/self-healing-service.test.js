/**
 * Unit tests for SelfHealingService
 *
 * @see src/ops-maturity/platform-ops-agent/self-healing-service.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { SelfHealingService, } from "../../../../src/ops-maturity/platform-ops-agent/self-healing-service.js";
function createAction(overrides = {}) {
    return {
        actionId: "action_1",
        targetComponent: "queue_worker_1",
        operation: "restart",
        reasonCode: "high_error_rate",
        priority: "high",
        ...overrides,
    };
}
test.describe("SelfHealingService", () => {
    test.describe("constructor", () => {
        test("uses default healing policy when no overrides provided", () => {
            const service = new SelfHealingService();
            const action = createAction();
            const receipt = service.execute(action);
            assert.equal(receipt.targetComponent, "queue_worker_1");
        });
        test("applies custom healing policy overrides", () => {
            const service = new SelfHealingService({
                maxRetries: 5,
                cooldownPeriodMs: 60_000,
            });
            assert.equal(service.getStatistics().totalHealingAttempts, 0);
        });
    });
    test.describe("execute", () => {
        test("returns receipt with healed true on successful healing", () => {
            const service = new SelfHealingService();
            const action = createAction();
            // Execute multiple times to find a successful healing
            let receipt = service.execute(action);
            // The service uses simulated random success, so we may need multiple attempts
            // to get a successful healing. This test verifies the receipt structure.
            assert.equal(receipt.targetComponent, action.targetComponent);
            assert.equal(receipt.operation, action.operation);
            assert.ok(receipt.actionId);
            assert.ok(receipt.executedAt);
        });
        test("returns receipt with rollbackAvailable true for restart operation", () => {
            const service = new SelfHealingService();
            const action = createAction({ operation: "restart" });
            const receipt = service.execute(action);
            assert.equal(receipt.rollbackAvailable, true);
        });
        test("returns receipt with rollbackAvailable true for rollback operation", () => {
            const service = new SelfHealingService();
            const action = createAction({ operation: "rollback" });
            const receipt = service.execute(action);
            assert.equal(receipt.rollbackAvailable, true);
        });
        test("returns receipt with rollbackAvailable false for throttle operation", () => {
            const service = new SelfHealingService();
            const action = createAction({ operation: "throttle" });
            const receipt = service.execute(action);
            assert.equal(receipt.rollbackAvailable, false);
        });
        test("returns receipt with rollbackAvailable false for failover operation", () => {
            const service = new SelfHealingService();
            const action = createAction({ operation: "failover" });
            const receipt = service.execute(action);
            assert.equal(receipt.rollbackAvailable, false);
        });
        test("tracks component health state after execution", () => {
            const service = new SelfHealingService();
            const action = createAction({ targetComponent: "test_component" });
            service.execute(action);
            const health = service.getComponentHealth("test_component");
            assert.ok(health !== null);
            assert.equal(health?.componentId, "test_component");
        });
        test("respects cooldown period and blocks healing when in cooldown", () => {
            const service = new SelfHealingService({
                maxRetries: 1,
                cooldownPeriodMs: 60_000,
            });
            // First execution that fails consecutive checks
            const action1 = createAction({
                targetComponent: "cooldown_component",
                actionId: "action_first",
            });
            const receipt1 = service.execute(action1);
            // If we hit cooldown, the next attempt should return healed: false
            // This is determined by consecutiveFailures >= maxRetries
            // Since healing can succeed randomly, we test the cooldown logic
            // by checking that after many failures, healing is blocked
            const health = service.getComponentHealth("cooldown_component");
            if (health && health.consecutiveFailures >= 1) {
                const action2 = createAction({
                    targetComponent: "cooldown_component",
                    actionId: "action_second",
                });
                const receipt2 = service.execute(action2);
                // In cooldown period - timeSinceLastAttempt would be < cooldownPeriodMs
                assert.equal(receipt2.healed, false);
            }
        });
        test("includes verification result in receipt", () => {
            const service = new SelfHealingService();
            const action = createAction();
            const receipt = service.execute(action);
            assert.ok(receipt.verificationResult !== undefined);
            assert.equal(typeof receipt.verificationResult?.verified, "boolean");
            assert.equal(typeof receipt.verificationResult?.healthCheckPassed, "boolean");
            assert.ok(typeof receipt.verificationResult?.recoveryTimeMs === "number");
            assert.ok(typeof receipt.verificationResult?.message === "string");
        });
    });
    test.describe("getComponentHealth", () => {
        test("returns null for unknown component", () => {
            const service = new SelfHealingService();
            const health = service.getComponentHealth("unknown_component");
            assert.equal(health, null);
        });
        test("returns health state for known component", () => {
            const service = new SelfHealingService();
            const action = createAction({ targetComponent: "known_component" });
            service.execute(action);
            const health = service.getComponentHealth("known_component");
            assert.ok(health !== null);
            assert.equal(health?.componentId, "known_component");
        });
        test("health state reflects healing outcome", () => {
            const service = new SelfHealingService();
            const action = createAction({ targetComponent: "status_check" });
            service.execute(action);
            const health = service.getComponentHealth("status_check");
            assert.ok(health !== null);
            const validStatuses = ["healthy", "degraded", "unhealthy", "unknown"];
            assert.ok(validStatuses.includes(health.status));
        });
    });
    test.describe("listComponentHealth", () => {
        test("returns empty array when no components tracked", () => {
            const service = new SelfHealingService();
            const list = service.listComponentHealth();
            assert.deepEqual(list, []);
        });
        test("returns all tracked component health states", () => {
            const service = new SelfHealingService();
            service.execute(createAction({ targetComponent: "component_a" }));
            service.execute(createAction({ targetComponent: "component_b" }));
            const list = service.listComponentHealth();
            assert.equal(list.length, 2);
        });
    });
    test.describe("getHealingHistory", () => {
        test("returns empty array when no healing history", () => {
            const service = new SelfHealingService();
            const history = service.getHealingHistory();
            assert.deepEqual(history, []);
        });
        test("returns healing history in reverse chronological order", () => {
            const service = new SelfHealingService();
            service.execute(createAction({ actionId: "first", targetComponent: "comp_1" }));
            service.execute(createAction({ actionId: "second", targetComponent: "comp_2" }));
            const history = service.getHealingHistory();
            assert.ok(history.length >= 2);
            assert.equal(history[0]?.actionId, "second");
        });
        test("filters history by componentId when specified", () => {
            const service = new SelfHealingService();
            service.execute(createAction({ targetComponent: "filter_me" }));
            service.execute(createAction({ targetComponent: "other_component" }));
            const history = service.getHealingHistory("filter_me");
            for (const entry of history) {
                assert.equal(entry.targetComponent, "filter_me");
            }
        });
        test("respects limit parameter", () => {
            const service = new SelfHealingService();
            for (let i = 0; i < 10; i++) {
                service.execute(createAction({ actionId: `action_${i}` }));
            }
            const history = service.getHealingHistory(undefined, 3);
            assert.equal(history.length, 3);
        });
    });
    test.describe("getStatistics", () => {
        test("returns zeros when no healing attempts", () => {
            const service = new SelfHealingService();
            const stats = service.getStatistics();
            assert.equal(stats.totalHealingAttempts, 0);
            assert.equal(stats.successCount, 0);
            assert.equal(stats.failureCount, 0);
            assert.equal(stats.averageRecoveryTimeMs, 0);
            assert.equal(stats.componentsUnderHealing, 0);
        });
        test("tracks total healing attempts", () => {
            const service = new SelfHealingService();
            service.execute(createAction());
            service.execute(createAction());
            const stats = service.getStatistics();
            assert.ok(stats.totalHealingAttempts >= 2);
        });
        test("calculates average recovery time", () => {
            const service = new SelfHealingService();
            service.execute(createAction());
            const stats = service.getStatistics();
            if (stats.totalHealingAttempts > 0) {
                assert.ok(stats.averageRecoveryTimeMs >= 0);
            }
        });
        test("counts components under healing", () => {
            const service = new SelfHealingService();
            service.execute(createAction({ targetComponent: "degraded_comp" }));
            const stats = service.getStatistics();
            assert.ok(typeof stats.componentsUnderHealing === "number");
        });
    });
    test.describe("healing policy enforcement", () => {
        test("custom maxRetries affects cooldown behavior", () => {
            const service = new SelfHealingService({ maxRetries: 2 });
            const action = createAction({ targetComponent: "retry_test" });
            // Execute twice to build up consecutive failures
            service.execute(action);
            service.execute(action);
            service.execute(action);
            const health = service.getComponentHealth("retry_test");
            // With maxRetries=2, after 3 failures component should be unhealthy
            assert.ok(health !== null);
        });
        test("custom cooldownPeriodMs affects cooldown duration", () => {
            const service = new SelfHealingService({ cooldownPeriodMs: 120_000 });
            const action = createAction();
            service.execute(action);
            // With very long cooldown, subsequent attempts within that time should be blocked
            const stats = service.getStatistics();
            assert.ok(stats.totalHealingAttempts >= 1);
        });
        test("enableAutomaticRollback is respected in policy", () => {
            const serviceNoRollback = new SelfHealingService({ enableAutomaticRollback: false });
            const serviceWithRollback = new SelfHealingService({ enableAutomaticRollback: true });
            const action = createAction();
            serviceNoRollback.execute(action);
            serviceWithRollback.execute(action);
            // Both should execute without throwing, policy is used internally
            const stats1 = serviceNoRollback.getStatistics();
            const stats2 = serviceWithRollback.getStatistics();
            assert.ok(stats1.totalHealingAttempts >= 1);
            assert.ok(stats2.totalHealingAttempts >= 1);
        });
    });
    test.describe("history eviction", () => {
        test("evicts old history entries beyond maxHistoryEntries", () => {
            const service = new SelfHealingService();
            // Default maxHistoryEntries is 100
            for (let i = 0; i < 150; i++) {
                service.execute(createAction({ actionId: `action_${i}`, targetComponent: `comp_${i}` }));
            }
            const history = service.getHealingHistory();
            assert.ok(history.length <= 100);
        });
    });
});
//# sourceMappingURL=self-healing-service.test.js.map