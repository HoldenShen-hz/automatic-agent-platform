/**
 * Integration Test: Effect Buffer
 *
 * Verifies the effect buffer correctly manages post-transaction side effects,
 * including effect scoping, priority ordering, commit/rollback, and compensation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  EffectBuilder,
  EffectBuffer,
  EffectScope,
  globalEffectBuffer,
  type Effect,
  type EffectScopeOptions,
  type EffectType,
  type EffectPriority,
} from "../../../../../src/platform/execution/execution-engine/effect-buffer.js";

test("effect scope: creates scope with options", () => {
  const scope = new EffectScope({
    scopeId: "test-scope-1",
    defaultTimeoutMs: 1000,
    stopOnFailure: false,
  });

  assert.equal(scope.getEffectCount(), 0, "New scope should have 0 effects");
  assert.equal(scope.isCommitted(), false, "New scope should not be committed");
  assert.equal(scope.isRolledBack(), false, "New scope should not be rolled back");
});

test("effect scope: addEffect increments effect count", () => {
  const scope = new EffectScope({ scopeId: "test-scope-add" });

  const effect: Effect = {
    id: "effect-1",
    type: "event_publish",
    description: "Test effect",
    priority: "normal",
    execute: async () => {},
    continueOnFailure: false,
  };

  scope.addEffect(effect);
  assert.equal(scope.getEffectCount(), 1, "Should have 1 effect after add");
});

test("effect scope: cannot add effects after commit", () => {
  const scope = new EffectScope({ scopeId: "test-scope-commit" });

  const effect: Effect = {
    id: "effect-1",
    type: "event_publish",
    description: "Test effect",
    priority: "normal",
    execute: async () => {},
    continueOnFailure: false,
  };

  scope.addEffect(effect);
  scope.commit();

  assert.throws(
    () => {
      scope.addEffect({
        ...effect,
        id: "effect-2",
      });
    },
    /already_committed/,
    "Should throw when adding effect after commit",
  );
});

test("effect scope: cannot add effects after rollback", () => {
  const scope = new EffectScope({ scopeId: "test-scope-rollback" });

  const effect: Effect = {
    id: "effect-1",
    type: "event_publish",
    description: "Test effect",
    priority: "normal",
    execute: async () => {},
    continueOnFailure: false,
  };

  scope.addEffect(effect);
  scope.rollback();

  assert.throws(
    () => {
      scope.addEffect({
        ...effect,
        id: "effect-2",
      });
    },
    /already_rolled_back/,
    "Should throw when adding effect after rollback",
  );
});

test("effect scope: commit marks scope as committed", () => {
  const scope = new EffectScope({ scopeId: "test-scope-commit-mark" });
  scope.commit();
  assert.equal(scope.isCommitted(), true, "Should be committed after commit()");
  assert.equal(scope.isRolledBack(), false, "Should not be rolled back");
});

test("effect scope: rollback marks scope as rolled back", () => {
  const scope = new EffectScope({ scopeId: "test-scope-rollback-mark" });
  scope.rollback();
  assert.equal(scope.isRolledBack(), true, "Should be rolled back after rollback()");
  assert.equal(scope.isCommitted(), false, "Should not be committed");
});

test("effect scope: executeEffects runs all effects in priority order", async () => {
  const scope = new EffectScope({ scopeId: "test-scope-priority" });
  const executionOrder: string[] = [];

  scope.addEffect({
    id: "effect-low",
    type: "event_publish",
    description: "Low priority",
    priority: "low",
    execute: async () => { executionOrder.push("low"); },
    continueOnFailure: false,
  });

  scope.addEffect({
    id: "effect-critical",
    type: "event_publish",
    description: "Critical priority",
    priority: "critical",
    execute: async () => { executionOrder.push("critical"); },
    continueOnFailure: false,
  });

  scope.addEffect({
    id: "effect-normal",
    type: "event_publish",
    description: "Normal priority",
    priority: "normal",
    execute: async () => { executionOrder.push("normal"); },
    continueOnFailure: false,
  });

  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.succeeded, 3, "All 3 effects should succeed");
  assert.equal(executionOrder[0], "critical", "Critical should execute first");
  assert.equal(executionOrder[1], "normal", "Normal should execute second");
  assert.equal(executionOrder[2], "low", "Low should execute last");
});

test("effect scope: executeEffects fails fast on error when stopOnFailure is true", async () => {
  const scope = new EffectScope({
    scopeId: "test-scope-stop",
    stopOnFailure: true,
  });

  scope.addEffect({
    id: "effect-fail",
    type: "event_publish",
    description: "Failing effect",
    priority: "normal",
    execute: async () => { throw new Error("Intentional failure"); },
    continueOnFailure: false,
  });

  scope.addEffect({
    id: "effect-never-run",
    type: "event_publish",
    description: "Never runs",
    priority: "normal",
    execute: async () => { throw new Error("Should not run"); },
    continueOnFailure: false,
  });

  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.succeeded, 0, "No effects should succeed");
  assert.equal(result.failed, 1, "One effect should fail");
  assert.equal(result.skipped, 1, "One effect should be skipped");
  assert.equal(result.allSucceeded, false, "Not all should succeed");
});

test("effect scope: continueOnFailure allows subsequent effects to run", async () => {
  const scope = new EffectScope({
    scopeId: "test-scope-continue",
    stopOnFailure: true, // Stop is true but continueOnFailure overrides
  });

  scope.addEffect({
    id: "effect-fail",
    type: "event_publish",
    description: "Failing effect",
    priority: "normal",
    execute: async () => { throw new Error("Intentional failure"); },
    continueOnFailure: true, // Override: continue despite failure
  });

  scope.addEffect({
    id: "effect-run",
    type: "event_publish",
    description: "Should still run",
    priority: "normal",
    execute: async () => {},
    continueOnFailure: false,
  });

  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.succeeded, 1, "One effect should succeed");
  assert.equal(result.failed, 1, "One effect should fail");
});

test("effect scope: executeEffects throws if not committed", async () => {
  const scope = new EffectScope({ scopeId: "test-scope-not-committed" });

  await assert.rejects(
    async () => scope.executeEffects(),
    /not_committed/,
    "Should throw if scope is not committed",
  );
});

test("effect scope: executeEffects throws if rolled back (not committed)", async () => {
  const scope = new EffectScope({ scopeId: "test-scope-rolled-back-execute" });
  scope.rollback();

  await assert.rejects(
    async () => scope.executeEffects(),
    /not_committed/,
    "Should throw if scope is rolled back (not committed)",
  );
});

test("effect scope: getCreatedAt returns timestamp", () => {
  const scope = new EffectScope({ scopeId: "test-scope-timestamp" });
  const before = Date.now();
  const createdAt = scope.getCreatedAt();
  const after = Date.now();

  assert.ok(createdAt >= before, "Created at should be >= before timestamp");
  assert.ok(createdAt <= after, "Created at should be <= after timestamp");
});

test("effect builder: creates effect with fluent API", () => {
  const effect = EffectBuilder.create("event_publish", "Test effect")
    .withId("custom-id")
    .withPriority("high")
    .withTimeout(5000)
    .withExecute(async () => {})
    .build();

  assert.equal(effect.id, "custom-id");
  assert.equal(effect.type, "event_publish");
  assert.equal(effect.description, "Test effect");
  assert.equal(effect.priority, "high");
  assert.equal(effect.timeoutMs, 5000);
});

test("effect builder: build without execute throws", () => {
  assert.throws(
    () => {
      EffectBuilder.create("event_publish", "Missing execute")
        .withId("test")
        .build();
    },
    /missing_execute/,
    "Should throw when build without execute",
  );
});

test("effect builder: continueOnFailure helper", () => {
  const effect = EffectBuilder.create("event_publish", "Continue on failure")
    .withExecute(async () => {})
    .continueOnFailure()
    .build();

  assert.equal(effect.continueOnFailure, true, "continueOnFailure should be true");
});

test("effect buffer: creates scope", () => {
  const buffer = new EffectBuffer();
  const scope = buffer.createScope({ scopeId: "new-scope" });

  assert.ok(scope != null, "Should create scope");
  assert.equal(scope.getEffectCount(), 0, "New scope should be empty");
  assert.equal(buffer.getScopeCount(), 1, "Buffer should have 1 scope");
});

test("effect buffer: getScope returns existing scope", () => {
  const buffer = new EffectBuffer();
  const created = buffer.createScope({ scopeId: "get-test" });
  const retrieved = buffer.getScope("get-test");

  assert.ok(retrieved != null, "Should retrieve scope");
  assert.strictEqual(retrieved, created, "Should be same instance");
});

test("effect buffer: getScope returns undefined for unknown scope", () => {
  const buffer = new EffectBuffer();
  const scope = buffer.getScope("unknown-scope");
  assert.equal(scope, undefined, "Should return undefined for unknown scope");
});

test("effect buffer: removeScope deletes scope", () => {
  const buffer = new EffectBuffer();
  buffer.createScope({ scopeId: "to-remove" });
  assert.equal(buffer.getScopeCount(), 1, "Should have 1 scope");

  buffer.removeScope("to-remove");
  assert.equal(buffer.getScopeCount(), 0, "Should have 0 scopes after removal");
});

test("effect buffer: clear removes all scopes", () => {
  const buffer = new EffectBuffer();
  buffer.createScope({ scopeId: "scope-1" });
  buffer.createScope({ scopeId: "scope-2" });
  buffer.createScope({ scopeId: "scope-3" });
  assert.equal(buffer.getScopeCount(), 3, "Should have 3 scopes");

  buffer.clear();
  assert.equal(buffer.getScopeCount(), 0, "Should have 0 scopes after clear");
});

test("effect buffer: flush executes committed scopes", async () => {
  const buffer = new EffectBuffer();
  let executed = false;

  const scope = buffer.createScope({ scopeId: "flush-test" });
  scope.add("event_publish", "Flush test", async () => { executed = true; });
  scope.commit();

  const results = await buffer.flush();

  assert.equal(executed, true, "Effect should be executed");
  assert.equal(results.length, 1, "Should have 1 result");
  assert.equal(results[0]!.allSucceeded, true, "All effects should succeed");
});

test("effect buffer: flush skips rolled back scopes", async () => {
  const buffer = new EffectBuffer();
  let executed = false;

  const scope = buffer.createScope({ scopeId: "skip-rolled-back" });
  scope.add("event_publish", "Should skip", async () => { executed = true; });
  scope.rollback();

  const results = await buffer.flush();

  assert.equal(executed, false, "Effect should not be executed");
  assert.equal(results.length, 0, "Should have 0 results");
});

test("effect buffer: flush skips uncommitted scopes", async () => {
  const buffer = new EffectBuffer();
  let executed = false;

  const scope = buffer.createScope({ scopeId: "skip-uncommitted" });
  scope.add("event_publish", "Should skip", async () => { executed = true; });
  // Note: not committed

  const results = await buffer.flush();

  assert.equal(executed, false, "Effect should not be executed");
  assert.equal(results.length, 0, "Should have 0 results");
});

test("effect buffer: global instance exists", () => {
  assert.ok(globalEffectBuffer != null, "Global effect buffer should exist");
  assert.ok(globalEffectBuffer instanceof EffectBuffer, "Should be instance of EffectBuffer");
});

test("effect scope: add() convenience method creates and adds effect", () => {
  const scope = new EffectScope({ scopeId: "add-convenience" });
  let executed = false;

  scope.add("event_publish", "Convenience add", async () => { executed = true; });
  scope.commit();

  assert.equal(scope.getEffectCount(), 1, "Should have 1 effect");
});

test("effect scope: compensation is called on compensateEffects", async () => {
  const scope = new EffectScope({ scopeId: "compensate-test" });
  let compensated = false;

  const effect: Effect = {
    id: "compensate-effect",
    type: "event_publish",
    description: "Compensate test",
    priority: "normal",
    execute: async () => {},
    compensate: async () => { compensated = true; },
    continueOnFailure: false,
  };

  scope.addEffect(effect);
  scope.commit();

  const result = await scope.executeEffects();
  assert.equal(result.succeeded, 1, "Effect should succeed");

  await scope.compensateEffects(result.results);
  assert.equal(compensated, true, "Compensation should be called");
});

test("effect scope: compensateEffects only calls compensation for successful effects", async () => {
  const scope = new EffectScope({ scopeId: "compensate-partial" });
  let compensated = false;

  const successEffect: Effect = {
    id: "success",
    type: "event_publish",
    description: "Success",
    priority: "normal",
    execute: async () => {},
    compensate: async () => { compensated = true; },
    continueOnFailure: false,
  };

  const failEffect: Effect = {
    id: "fail",
    type: "event_publish",
    description: "Fail",
    priority: "normal",
    execute: async () => { throw new Error("Fail"); },
    continueOnFailure: false,
  };

  scope.addEffect(successEffect);
  scope.addEffect(failEffect);
  scope.commit();

  const result = await scope.executeEffects();
  // Only success effect should be compensated
  await scope.compensateEffects(result.results);
  assert.equal(compensated, true, "Success effect should be compensated");
});

test("effect scope: effect timeout works", async () => {
  const scope = new EffectScope({ scopeId: "timeout-test" });

  scope.addEffect({
    id: "timeout-effect",
    type: "event_publish",
    description: "Times out",
    priority: "normal",
    timeoutMs: 50,
    execute: async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
    continueOnFailure: false,
  });

  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.failed, 1, "Effect should fail due to timeout");
  assert.ok(result.results[0]!.error != null, "Should have error");
});
