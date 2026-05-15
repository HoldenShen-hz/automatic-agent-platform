/**
 * E2E Effect Buffer Tests
 *
 * End-to-end tests for effect buffer functionality.
 * Tests cover:
 * 1. EffectScope creation and effect management
 * 2. Effect execution and prioritization
 * 3. Effect compensation
 * 4. EffectBuffer scope management
 * 5. Builder pattern for effects
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  EffectBuilder,
  EffectScope,
  EffectBuffer,
  type Effect,
  type EffectScopeOptions,
} from "../../src/platform/five-plane-execution/execution-engine/effect-buffer.js";

// ============================================================================
// Test Suite 1: EffectBuilder
// ============================================================================

test("E2E EffectBuffer: EffectBuilder creates effect with required fields", () => {
  const effect = EffectBuilder.create("event_publish", "Publish user event")
    .withExecute(async () => {})
    .build();

  assert.ok(effect.id);
  assert.equal(effect.type, "event_publish");
  assert.equal(effect.description, "Publish user event");
  assert.equal(effect.priority, "normal");
});

test("E2E EffectBuffer: EffectBuilder withId sets custom id", () => {
  const effect = EffectBuilder.create("callback_invoke", "Invoke callback")
    .withId("custom-effect-id")
    .withExecute(async () => {})
    .build();

  assert.equal(effect.id, "custom-effect-id");
});

test("E2E EffectBuffer: EffectBuilder withPriority sets priority", () => {
  const effect = EffectBuilder.create("metric_record", "Record metric")
    .withPriority("high")
    .withExecute(async () => {})
    .build();

  assert.equal(effect.priority, "high");
});

test("E2E EffectBuffer: EffectBuilder withTimeout sets timeout", () => {
  const effect = EffectBuilder.create("ui_update", "Update UI")
    .withTimeout(5000)
    .withExecute(async () => {})
    .build();

  assert.equal(effect.timeoutMs, 5000);
});

test("E2E EffectBuffer: EffectBuilder withCompensate sets compensation", async () => {
  let compensated = false;
  const effect = EffectBuilder.create("external_notification", "Send notification")
    .withExecute(async () => {})
    .withCompensate(async () => {
      compensated = true;
    })
    .build();

  assert.ok(effect.compensate);
  await effect.compensate!();
  assert.equal(compensated, true);
});

test("E2E EffectBuffer: EffectBuilder continueOnFailure allows failure", () => {
  const effect = EffectBuilder.create("artifact_flush", "Flush artifact")
    .withExecute(async () => {})
    .continueOnFailure()
    .build();

  assert.equal(effect.continueOnFailure, true);
});

test("E2E EffectBuffer: EffectBuilder throws without execute", () => {
  assert.throws(() => {
    EffectBuilder.create("event_publish", "Missing execute").build();
  }, /missing_execute/i);
});

// ============================================================================
// Test Suite 2: EffectScope - Basic Operations
// ============================================================================

test("E2E EffectBuffer: EffectScope creates with options", () => {
  const scope = new EffectScope({
    scopeId: "test-scope-1",
    defaultTimeoutMs: 3000,
    stopOnFailure: true,
  });

  assert.equal(scope.getEffectCount(), 0);
  assert.equal(scope.isCommitted(), false);
  assert.equal(scope.isRolledBack(), false);
});

test("E2E EffectScope: addEffect adds effect to scope", () => {
  const scope = new EffectScope({ scopeId: "test-scope-2" });

  const effect: Effect = {
    id: "effect-1",
    type: "event_publish",
    description: "Test effect",
    priority: "normal",
    execute: async () => {},
    continueOnFailure: false,
  };

  scope.addEffect(effect);

  assert.equal(scope.getEffectCount(), 1);
});

test("E2E EffectScope: add fluent method creates and adds effect", () => {
  const scope = new EffectScope({ scopeId: "test-scope-3" });

  scope.add("event_publish", "Publish event", async () => {});

  assert.equal(scope.getEffectCount(), 1);
});

test("E2E EffectScope: commit marks scope as committed", () => {
  const scope = new EffectScope({ scopeId: "test-scope-4" });
  scope.commit();

  assert.equal(scope.isCommitted(), true);
});

test("E2E EffectScope: rollback marks scope as rolled back", () => {
  const scope = new EffectScope({ scopeId: "test-scope-5" });
  scope.rollback();

  assert.equal(scope.isRolledBack(), true);
});

test("E2E EffectScope: cannot add effect after commit", () => {
  const scope = new EffectScope({ scopeId: "test-scope-6" });
  scope.commit();

  const effect: Effect = {
    id: "effect-fail",
    type: "event_publish",
    description: "Should fail",
    priority: "normal",
    execute: async () => {},
    continueOnFailure: false,
  };

  assert.throws(() => {
    scope.addEffect(effect);
  }, /already_committed/i);
});

test("E2E EffectScope: cannot add effect after rollback", () => {
  const scope = new EffectScope({ scopeId: "test-scope-7" });
  scope.rollback();

  const effect: Effect = {
    id: "effect-fail",
    type: "event_publish",
    description: "Should fail",
    priority: "normal",
    execute: async () => {},
    continueOnFailure: false,
  };

  assert.throws(() => {
    scope.addEffect(effect);
  }, /already_rolled_back/i);
});

// ============================================================================
// Test Suite 3: EffectScope - Execution
// ============================================================================

test("E2E EffectScope: executeEffects runs all effects in priority order", async () => {
  const scope = new EffectScope({ scopeId: "test-scope-8" });
  const executionOrder: string[] = [];

  scope.addEffect(
    EffectBuilder.create("metric_record", "Low priority")
      .withPriority("low")
      .withExecute(async () => { executionOrder.push("low"); })
      .build()
  );

  scope.addEffect(
    EffectBuilder.create("event_publish", "High priority")
      .withPriority("high")
      .withExecute(async () => { executionOrder.push("high"); })
      .build()
  );

  scope.addEffect(
    EffectBuilder.create("ui_update", "Normal priority")
      .withPriority("normal")
      .withExecute(async () => { executionOrder.push("normal"); })
      .build()
  );

  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.succeeded, 3);
  assert.equal(result.allSucceeded, true);
  // High priority runs first
  assert.equal(executionOrder[0], "high");
  assert.equal(executionOrder[1], "normal");
  assert.equal(executionOrder[2], "low");
});

test("E2E EffectScope: executeEffects fails on effect error", async () => {
  const scope = new EffectScope({ scopeId: "test-scope-9" });

  scope.add("event_publish", "Failing effect", async () => {
    throw new Error("Intentional failure");
  });

  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.failed, 1);
  assert.equal(result.allSucceeded, false);
});

test("E2E EffectScope: executeEffects continues when continueOnFailure is set", async () => {
  const scope = new EffectScope({ scopeId: "test-scope-10" });
  const executionOrder: string[] = [];

  scope.addEffect(
    EffectBuilder.create("event_publish", "Failing effect")
      .continueOnFailure()
      .withExecute(async () => {
        executionOrder.push("fail");
        throw new Error("Intentional failure");
      })
      .build()
  );

  scope.add("ui_update", "Second effect", async () => {
    executionOrder.push("second");
  });

  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.failed, 1);
  assert.equal(result.succeeded, 1);
  assert.deepEqual(executionOrder, ["fail", "second"]);
});

test("E2E EffectScope: executeEffects skips rolled back scope", async () => {
  const scope = new EffectScope({ scopeId: "test-scope-11" });

  scope.add("event_publish", "Should not run", async () => {
    throw new Error("Should not execute");
  });

  scope.commit();
  scope.rollback();
  const result = await scope.executeEffects();

  assert.equal(result.skipped, 1);
  assert.equal(result.succeeded, 0);
});

test("E2E EffectScope: executeEffects throws if not committed", async () => {
  const scope = new EffectScope({ scopeId: "test-scope-12" });

  scope.add("event_publish", "Test", async () => {});

  await assert.rejects(
    async () => scope.executeEffects(),
    /not_committed/i,
  );
});

// ============================================================================
// Test Suite 4: EffectScope - Compensation
// ============================================================================

test("E2E EffectScope: compensateEffects runs compensation in reverse order", async () => {
  const scope = new EffectScope({ scopeId: "test-scope-13" });
  const compensationOrder: string[] = [];

  scope.addEffect(
    EffectBuilder.create("external_notification", "First")
      .withExecute(async () => {})
      .withCompensate(async () => {
        compensationOrder.push("first");
      })
      .build()
  );

  scope.addEffect(
    EffectBuilder.create("ui_update", "Second")
      .withExecute(async () => {})
      .withCompensate(async () => {
        compensationOrder.push("second");
      })
      .build()
  );

  scope.commit();
  const result = await scope.executeEffects();

  await scope.compensateEffects(result.results);

  // Compensation runs in reverse
  assert.deepEqual(compensationOrder, ["second", "first"]);
});

// ============================================================================
// Test Suite 5: EffectBuffer - Scope Management
// ============================================================================

test("E2E EffectBuffer: createScope creates and stores scope", () => {
  const buffer = new EffectBuffer();

  const scope = buffer.createScope({ scopeId: "buffer-scope-1" });

  assert.ok(scope);
  assert.equal(buffer.getScopeCount(), 1);
  assert.ok(buffer.getScope("buffer-scope-1"));
});

test("E2E EffectBuffer: getScope returns undefined for non-existent", () => {
  const buffer = new EffectBuffer();

  assert.equal(buffer.getScope("non-existent"), undefined);
});

test("E2E EffectBuffer: removeScope removes scope", () => {
  const buffer = new EffectBuffer();

  buffer.createScope({ scopeId: "scope-to-remove" });
  assert.equal(buffer.getScopeCount(), 1);

  buffer.removeScope("scope-to-remove");
  assert.equal(buffer.getScopeCount(), 0);
});

test("E2E EffectBuffer: clear removes all scopes", () => {
  const buffer = new EffectBuffer();

  buffer.createScope({ scopeId: "scope-1" });
  buffer.createScope({ scopeId: "scope-2" });
  buffer.createScope({ scopeId: "scope-3" });

  assert.equal(buffer.getScopeCount(), 3);

  buffer.clear();

  assert.equal(buffer.getScopeCount(), 0);
});

// ============================================================================
// Test Suite 6: EffectBuffer - Flush
// ============================================================================

test("E2E EffectBuffer: flush executes all committed scopes", async () => {
  const buffer = new EffectBuffer();
  let executed = false;

  const scope = buffer.createScope({ scopeId: "flush-scope-1" });
  scope.add("event_publish", "Test", async () => {
    executed = true;
  });
  scope.commit();

  const results = await buffer.flush();

  assert.equal(executed, true);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.succeeded, 1);
});

test("E2E EffectBuffer: flush skips rolled back scopes", async () => {
  const buffer = new EffectBuffer();
  let executed = false;

  const scope = buffer.createScope({ scopeId: "rollback-scope-1" });
  scope.add("event_publish", "Should not run", async () => {
    executed = true;
  });
  scope.rollback();

  const results = await buffer.flush();

  assert.equal(executed, false);
  assert.equal(results.length, 0);
});

test("E2E EffectBuffer: flush skips non-committed scopes", async () => {
  const buffer = new EffectBuffer();
  let executed = false;

  const scope = buffer.createScope({ scopeId: "noncommitted-scope-1" });
  scope.add("event_publish", "Should not run", async () => {
    executed = true;
  });
  // Note: not committed

  const results = await buffer.flush();

  assert.equal(executed, false);
  assert.equal(results.length, 0);
});

test("E2E EffectBuffer: flush multiple scopes in order", async () => {
  const buffer = new EffectBuffer();
  const executionOrder: string[] = [];

  const scope1 = buffer.createScope({ scopeId: "multi-scope-1" });
  scope1.add("event_publish", "First", async () => {
    executionOrder.push("first");
  });
  scope1.commit();

  const scope2 = buffer.createScope({ scopeId: "multi-scope-2" });
  scope2.add("event_publish", "Second", async () => {
    executionOrder.push("second");
  });
  scope2.commit();

  await buffer.flush();

  assert.deepEqual(executionOrder, ["first", "second"]);
});

// ============================================================================
// Test Suite 7: Effect Types
// ============================================================================

test("E2E EffectBuffer: all effect types can be created", () => {
  const effectTypes = [
    "event_publish",
    "stream_emit",
    "callback_invoke",
    "ui_update",
    "external_notification",
    "artifact_flush",
    "metric_record",
  ] as const;

  for (const type of effectTypes) {
    const effect = EffectBuilder.create(type, `Test ${type}`)
      .withExecute(async () => {})
      .build();

    assert.equal(effect.type, type);
  }
});

// ============================================================================
// Test Suite 8: Priority Order
// ============================================================================

test("E2E EffectBuffer: effects execute in priority order critical > high > normal > low", async () => {
  const scope = new EffectScope({ scopeId: "priority-test-scope" });
  const order: string[] = [];

  scope.addEffect(
    EffectBuilder.create("metric_record", "low")
      .withPriority("low")
      .withExecute(async () => { order.push("low"); })
      .build()
  );
  scope.addEffect(
    EffectBuilder.create("metric_record", "high")
      .withPriority("high")
      .withExecute(async () => { order.push("high"); })
      .build()
  );
  scope.addEffect(
    EffectBuilder.create("metric_record", "critical")
      .withPriority("critical")
      .withExecute(async () => { order.push("critical"); })
      .build()
  );
  scope.addEffect(
    EffectBuilder.create("metric_record", "normal")
      .withPriority("normal")
      .withExecute(async () => { order.push("normal"); })
      .build()
  );

  scope.commit();
  await scope.executeEffects();

  assert.deepEqual(order, ["critical", "high", "normal", "low"]);
});
