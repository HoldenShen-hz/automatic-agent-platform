/**
 * E2E Config Rollout Tests
 *
 * End-to-end tests covering configuration rollout scenarios:
 * - Canary rollout phases (0% -> 5% -> 25% -> 50% -> 100%)
 * - Rollout decisions based on deterministic hashing
 * - Manual promotion and cancellation
 * - Auto-progress based on elapsed time and health gates
 * - Rollout cleanup and lifecycle management
 *
 * Issue: R15-87 | Missing config-rollout e2e tests
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { ConfigRolloutService, RolloutPhase, type ConfigRollout, type RolloutDecision } from "../../src/platform/five-plane-control-plane/config-center/config-rollout-service.js";
import { ConfigRolloutRepository, type InMemoryConfigRolloutStore } from "../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/config-rollout-repository.js";

// ---------------------------------------------------------------------------
// Test 1: Start a new config rollout with canary strategy
// ---------------------------------------------------------------------------

test("E2E Config Rollout: starts a new rollout with canary phases", () => {
  const harness = createE2EHarness("aa-e2e-config-rollout-");
  try {
    const repo = new ConfigRolloutRepository(harness.db);
    const store: InMemoryConfigRolloutStore = {
      rollouts: new Map(),
      save(rollout: ConfigRollout) {
        this.rollouts.set(rollout.rolloutId, rollout);
      },
      loadAll(): ConfigRollout[] {
        return Array.from(this.rollouts.values());
      },
      delete(rolloutId: string) {
        this.rollouts.delete(rolloutId);
      },
    };
    const service = new ConfigRolloutService({ store });

    // Start a rollout
    const rollout = service.startRollout("providers.defaultProvider", "platform", null, 100);

    // Verify rollout created with initial canary phase
    assert.ok(rollout.rolloutId, "Should have rolloutId");
    assert.equal(rollout.configPath, "providers.defaultProvider");
    assert.equal(rollout.layer, "platform");
    assert.equal(rollout.stage.phase, RolloutPhase.CANARY_5, "Should start at CANARY_5 for 100% target");
    assert.equal(rollout.currentPercentage, 5, "Should be at 5% initially");
    assert.equal(rollout.targetPercentage, 100);

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Rollout decision respects percentage based on hash
// ---------------------------------------------------------------------------

test("E2E Config Rollout: shouldApplyConfig respects deterministic hash percentage", () => {
  const harness = createE2EHarness("aa-e2e-config-rollout-hash-");
  try {
    const store: InMemoryConfigRolloutStore = {
      rollouts: new Map(),
      save(rollout: ConfigRollout) {
        this.rollouts.set(rollout.rolloutId, rollout);
      },
      loadAll(): ConfigRollout[] {
        return Array.from(this.rollouts.values());
      },
      delete(rolloutId: string) {
        this.rollouts.delete(rolloutId);
      },
    };
    const service = new ConfigRolloutService({ store });

    // Start a rollout at 50%
    const rollout = service.startRollout("runtime.maxRetries", "platform", null, 50);
    // Force the rollout to HALF stage for testing
    rollout.stage = {
      phase: RolloutPhase.HALF,
      percentage: 50,
      minDurationMs: 0,
      autoProgress: false,
    };
    rollout.currentPercentage = 50;
    store.save(rollout);

    // Hash that falls within 50% should apply
    const decisionWithin = service.shouldApplyConfig("runtime.maxRetries", "platform", null, "tenant-001");
    assert.equal(decisionWithin.shouldApply, true, "Hash within percentage should apply");
    assert.equal(decisionWithin.percentage, 50);

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Rollout promotion advances through stages
// ---------------------------------------------------------------------------

test("E2E Config Rollout: promoteRollout advances to next stage", () => {
  const harness = createE2EHarness("aa-e2e-config-rollout-promote-");
  try {
    const store: InMemoryConfigRolloutStore = {
      rollouts: new Map(),
      save(rollout: ConfigRollout) {
        this.rollouts.set(rollout.rolloutId, rollout);
      },
      loadAll(): ConfigRollout[] {
        return Array.from(this.rollouts.values());
      },
      delete(rolloutId: string) {
        this.rollouts.delete(rolloutId);
      },
    };
    const service = new ConfigRolloutService({ store });

    const rollout = service.startRollout("security.sandboxMode", "platform", null, 100);
    assert.equal(rollout.stage.phase, RolloutPhase.CANARY_5);

    // Promote to next stage
    const promoted = service.promoteRollout(rollout.rolloutId);
    assert.ok(promoted, "Should return promoted rollout");
    assert.equal(promoted!.stage.phase, RolloutPhase.CANARY_25, "Should advance to CANARY_25");

    // Promote again
    const promoted2 = service.promoteRollout(rollout.rolloutId);
    assert.equal(promoted2!.stage.phase, RolloutPhase.HALF, "Should advance to HALF");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Cancel rollout stops config from being applied
// ---------------------------------------------------------------------------

test("E2E Config Rollout: cancelRollout prevents config application", () => {
  const harness = createE2EHarness("aa-e2e-config-rollout-cancel-");
  try {
    const store: InMemoryConfigRolloutStore = {
      rollouts: new Map(),
      save(rollout: ConfigRollout) {
        this.rollouts.set(rollout.rolloutId, rollout);
      },
      loadAll(): ConfigRollout[] {
        return Array.from(this.rollouts.values());
      },
      delete(rolloutId: string) {
        this.rollouts.delete(rolloutId);
      },
    };
    const service = new ConfigRolloutService({ store });

    const rollout = service.startRollout("runtime.timeoutMs", "platform", null, 100);
    const cancelled = service.cancelRollout(rollout.rolloutId);

    assert.ok(cancelled, "Should return cancelled rollout");
    assert.equal(cancelled!.stage.phase, RolloutPhase.CANCELLED);

    // Try to apply config - should be rejected
    const decision = service.shouldApplyConfig("runtime.timeoutMs", "platform", null, "tenant-001");
    assert.equal(decision.shouldApply, false, "Cancelled rollout should not apply");
    assert.equal(decision.reason, "rollout_cancelled");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: Auto-progress advances rollouts based on elapsed time
// ---------------------------------------------------------------------------

test("E2E Config Rollout: autoProgressRollouts advances based on time and health", () => {
  const harness = createE2EHarness("aa-e2e-config-rollout-autoprog-");
  try {
    const store: InMemoryConfigRolloutStore = {
      rollouts: new Map(),
      save(rollout: ConfigRollout) {
        this.rollouts.set(rollout.rolloutId, rollout);
      },
      loadAll(): ConfigRollout[] {
        return Array.from(this.rollouts.values());
      },
      delete(rolloutId: string) {
        this.rollouts.delete(rolloutId);
      },
    };
    const service = new ConfigRolloutService({ store });

    // Start rollout at CANARY_5 (5% with 30min auto-progress)
    const rollout = service.startRollout("gateways.defaultTimeout", "platform", null, 100);

    // Manually set updatedAt to 31 minutes ago to trigger auto-progress
    const oldDate = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    rollout.updatedAt = oldDate;
    rollout.stage = {
      phase: RolloutPhase.CANARY_5,
      percentage: 5,
      minDurationMs: 1800000, // 30 minutes
      autoProgress: true,
    };
    store.save(rollout);

    // Auto-progress with healthy metrics
    const healthSnapshots = {
      [rollout.rolloutId]: {
        errorRate: 0.01,
        latencyRegression: 0.1,
        incidentRate: 0.01,
      },
    };

    const progressCount = service.autoProgressRollouts(healthSnapshots);
    assert.equal(progressCount, 1, "Should have auto-progressed one rollout");

    const progressedRollout = service.getActiveRollout("gateways.defaultTimeout", "platform", null);
    assert.equal(progressedRollout!.stage.phase, RolloutPhase.CANARY_25);

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 6: Auto-progress respects health gates
// ---------------------------------------------------------------------------

test("E2E Config Rollout: autoProgressRollouts blocks on unhealthy metrics", () => {
  const harness = createE2EHarness("aa-e2e-config-rollout-health-");
  try {
    const store: InMemoryConfigRolloutStore = {
      rollouts: new Map(),
      save(rollout: ConfigRollout) {
        this.rollouts.set(rollout.rolloutId, rollout);
      },
      loadAll(): ConfigRollout[] {
        return Array.from(this.rollouts.values());
      },
      delete(rolloutId: string) {
        this.rollouts.delete(rolloutId);
      },
    };
    const service = new ConfigRolloutService({ store });

    const rollout = service.startRollout("providers.retryDelay", "platform", null, 100);

    // Set to a stage that should auto-progress
    rollout.stage = {
      phase: RolloutPhase.CANARY_5,
      percentage: 5,
      minDurationMs: 0, // No minimum time
      autoProgress: true,
    };
    rollout.updatedAt = new Date(Date.now() - 10000).toISOString();
    store.save(rollout);

    // Unhealthy metrics - high error rate
    const healthSnapshots = {
      [rollout.rolloutId]: {
        errorRate: 0.10, // 10% - exceeds 5% threshold
        latencyRegression: 0.1,
        incidentRate: 0.01,
      },
    };

    const progressCount = service.autoProgressRollouts(healthSnapshots);
    assert.equal(progressCount, 0, "Should not progress with unhealthy metrics");

    const unchangedRollout = service.getActiveRollout("providers.retryDelay", "platform", null);
    assert.equal(unchangedRollout!.stage.phase, RolloutPhase.CANARY_5, "Should remain at CANARY_5");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 7: Cleanup removes old completed rollouts
// ---------------------------------------------------------------------------

test("E2E Config Rollout: cleanupRollouts removes old completed rollouts", () => {
  const harness = createE2EHarness("aa-e2e-config-rollout-cleanup-");
  try {
    const store: InMemoryConfigRolloutStore = {
      rollouts: new Map(),
      save(rollout: ConfigRollout) {
        this.rollouts.set(rollout.rolloutId, rollout);
      },
      loadAll(): ConfigRollout[] {
        return Array.from(this.rollouts.values());
      },
      delete(rolloutId: string) {
        this.rollouts.delete(rolloutId);
      },
    };
    const service = new ConfigRolloutService({ store });

    const rollout1 = service.startRollout("runtime.concurrentLimit", "platform", null, 100);
    const rollout2 = service.startRollout("security.allowWrite", "platform", null, 100);

    // Advance rollout1 to FULL
    rollout1.stage = {
      phase: RolloutPhase.FULL,
      percentage: 100,
      minDurationMs: 0,
      autoProgress: false,
    };
    rollout1.updatedAt = new Date(Date.now() - 90000000).toISOString(); // 25 hours ago
    store.save(rollout1);

    // Set rollout2 to PENDING (not completed)
    rollout2.updatedAt = new Date(Date.now() - 90000000).toISOString();
    store.save(rollout2);

    const cleaned = service.cleanupRollouts(86400000); // 24 hours
    assert.equal(cleaned, 1, "Should clean up 1 rollout");

    const remaining = service.getActiveRollouts();
    assert.equal(remaining.length, 1, "Should have 1 remaining rollout");
    assert.equal(remaining[0].rolloutId, rollout2.rolloutId);

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 8: No active rollout applies config immediately
// ---------------------------------------------------------------------------

test("E2E Config Rollout: no active rollout applies config immediately", () => {
  const harness = createE2EHarness("aa-e2e-config-rollout-none-");
  try {
    const store: InMemoryConfigRolloutStore = {
      rollouts: new Map(),
      save() {},
      loadAll() { return []; },
      delete() {},
    };
    const service = new ConfigRolloutService({ store });

    const decision = service.shouldApplyConfig("runtime.maxDuration", "platform", null, "tenant-xyz");

    assert.equal(decision.shouldApply, true, "Should apply when no rollout");
    assert.equal(decision.percentage, 100, "Should be 100%");
    assert.equal(decision.rolloutId, null, "Should have no rollout ID");
    assert.equal(decision.reason, "no_active_rollout");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 9: Get active rollouts returns all current rollouts
// ---------------------------------------------------------------------------

test("E2E Config Rollout: getActiveRollouts returns all active rollouts", () => {
  const harness = createE2EHarness("aa-e2e-config-rollout-active-");
  try {
    const store: InMemoryConfigRolloutStore = {
      rollouts: new Map(),
      save(rollout: ConfigRollout) {
        this.rollouts.set(rollout.rolloutId, rollout);
      },
      loadAll(): ConfigRollout[] {
        return Array.from(this.rollouts.values());
      },
      delete(rolloutId: string) {
        this.rollouts.delete(rolloutId);
      },
    };
    const service = new ConfigRolloutService({ store });

    service.startRollout("providers.defaultModel", "platform", null, 100);
    service.startRollout("runtime.timeoutMs", "tenant", "tenant-001", 50);
    service.startRollout("security.sandboxMode", "pack", "pack-002", 100);

    const activeRollouts = service.getActiveRollouts();
    assert.equal(activeRollouts.length, 3, "Should have 3 active rollouts");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// End of E2E Config Rollout Tests
// ---------------------------------------------------------------------------