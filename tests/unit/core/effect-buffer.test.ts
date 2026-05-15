import assert from "node:assert/strict";
import test from "node:test";

import {
  EffectBuilder,
  EffectScope,
  EffectBuffer,
} from "../../../src/platform/five-plane-execution/execution-engine/effect-buffer.js";

test("EffectBuilder creates effect with required fields", () => {
  const effect = EffectBuilder.create("event_publish", "Test effect")
    .withExecute(async () => {})
    .build();

  assert.ok(effect.id.startsWith("effect_"));
  assert.equal(effect.type, "event_publish");
  assert.equal(effect.description, "Test effect");
  assert.equal(effect.priority, "normal");
  assert.equal(effect.continueOnFailure, false);
});

test("EffectBuilder withId sets custom id", () => {
  const effect = EffectBuilder.create("event_publish", "Test")
    .withId("custom_id_123")
    .withExecute(async () => {})
    .build();

  assert.equal(effect.id, "custom_id_123");
});

test("EffectBuilder withPriority sets priority", () => {
  const effect = EffectBuilder.create("callback_invoke", "Test")
    .withPriority("critical")
    .withExecute(async () => {})
    .build();

  assert.equal(effect.priority, "critical");
});

test("EffectBuilder withTimeout sets timeout", () => {
  const effect = EffectBuilder.create("ui_update", "Test")
    .withTimeout(10000)
    .withExecute(async () => {})
    .build();

  assert.equal(effect.timeoutMs, 10000);
});

test("EffectBuilder continueOnFailure sets flag", () => {
  const effect = EffectBuilder.create("external_notification", "Test")
    .withExecute(async () => {})
    .continueOnFailure()
    .build();

  assert.equal(effect.continueOnFailure, true);
});

test("EffectBuilder withCompensate sets compensation", () => {
  const compensateFn = async () => {};
  const effect = EffectBuilder.create("stream_emit", "Test")
    .withExecute(async () => {})
    .withCompensate(compensateFn)
    .build();

  assert.ok(effect.compensate === compensateFn);
});

test("EffectBuilder build() throws when execute not set", () => {
  let threw = false;
  try {
    const builder = EffectBuilder.create("metric_record", "Test");
    builder.build();
  } catch {
    threw = true;
  }
  assert.equal(threw, true, "Should throw when execute not set");
});

test("EffectScope creates and manages effects", () => {
  const scope = new EffectScope({
    scopeId: "test_scope_1",
  });

  const effect = EffectBuilder.create("event_publish", "Test")
    .withExecute(async () => {})
    .build();

  scope.addEffect(effect);
  assert.equal(scope.getEffectCount(), 1);
});

test("EffectScope add adds effect via fluent builder", () => {
  const scope = new EffectScope({
    scopeId: "test_scope_2",
  });

  scope.add("event_publish", "Test effect", async () => {});
  assert.equal(scope.getEffectCount(), 1);
});

test("EffectScope commit marks scope as committed", () => {
  const scope = new EffectScope({
    scopeId: "test_scope_3",
  });

  assert.equal(scope.isCommitted(), false);
  scope.commit();
  assert.equal(scope.isCommitted(), true);
});

test("EffectScope rollback marks scope as rolled back", () => {
  const scope = new EffectScope({
    scopeId: "test_scope_4",
  });

  assert.equal(scope.isRolledBack(), false);
  scope.rollback();
  assert.equal(scope.isRolledBack(), true);
});

test("EffectScope cannot add effect after commit", () => {
  const scope = new EffectScope({
    scopeId: "test_scope_5",
  });

  scope.commit();
  let threw = false;
  try {
    const effect = EffectBuilder.create("event_publish", "Test")
      .withExecute(async () => {})
      .build();
    scope.addEffect(effect);
  } catch {
    threw = true;
  }
  assert.equal(threw, true, "Should throw when adding effect after commit");
});

test("EffectScope cannot add effect after rollback", () => {
  const scope = new EffectScope({
    scopeId: "test_scope_6",
  });

  scope.rollback();
  let threw = false;
  try {
    const effect = EffectBuilder.create("event_publish", "Test")
      .withExecute(async () => {})
      .build();
    scope.addEffect(effect);
  } catch {
    threw = true;
  }
  assert.equal(threw, true, "Should throw when adding effect after rollback");
});

test("EffectScope executeEffects runs all effects", async () => {
  let executionCount = 0;
  const scope = new EffectScope({
    scopeId: "test_scope_7",
    defaultTimeoutMs: 1000,
  });

  scope.add("event_publish", "Effect 1", async () => { executionCount++; });
  scope.add("event_publish", "Effect 2", async () => { executionCount++; });
  scope.commit();

  const result = await scope.executeEffects();

  assert.equal(result.totalEffects, 2);
  assert.equal(result.succeeded, 2);
  assert.equal(result.failed, 0);
  assert.equal(executionCount, 2);
  assert.equal(result.allSucceeded, true);
});

test("EffectScope executeEffects throws when not committed", async () => {
  const scope = new EffectScope({
    scopeId: "test_scope_8",
  });

  let threw = false;
  try {
    await scope.executeEffects();
  } catch {
    threw = true;
  }
  assert.equal(threw, true, "Should throw when executing uncommitted scope");
});

test("EffectScope executeEffects skips effects on rolled back scope", async () => {
  const scope = new EffectScope({
    scopeId: "test_scope_9",
  });

  scope.add("event_publish", "Effect 1", async () => {});
  scope.commit(); // Must commit first, then rollback
  scope.rollback();

  const result = await scope.executeEffects();

  // With rollback after commit, skipped should be all effects
  assert.equal(result.skipped, result.totalEffects);
  assert.equal(result.allSucceeded, true);
});

test("EffectScope executeEffects handles effect failure", async () => {
  const scope = new EffectScope({
    scopeId: "test_scope_10",
    stopOnFailure: false,
  });

  scope.add("event_publish", "Success effect", async () => {});
  scope.add("event_publish", "Failing effect", async () => { throw new Error("Intentional failure"); });
  scope.commit();

  const result = await scope.executeEffects();

  assert.equal(result.totalEffects, 2);
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.allSucceeded, false);
});

test("EffectScope executeEffects continues when continueOnFailure is true", async () => {
  const scope = new EffectScope({
    scopeId: "test_scope_10b",
    stopOnFailure: false,
  });

  let executionCount = 0;
  scope.add("event_publish", "Failing effect", async () => { throw new Error("Fail"); });
  scope.add("event_publish", "Next effect", async () => { executionCount++; });
  scope.addEffect({
    id: "continue_effect",
    type: "event_publish",
    description: "Continue effect",
    priority: "normal",
    continueOnFailure: true,
    execute: async () => { executionCount++; },
  });

  scope.commit();

  const result = await scope.executeEffects();

  assert.equal(result.failed, 1);
  assert.ok(result.succeeded >= 1);
});

test("EffectScope executeEffects respects priority order", async () => {
  const executionOrder: string[] = [];
  const scope = new EffectScope({
    scopeId: "test_scope_12",
  });

  scope.addEffect({
    id: "effect_low",
    type: "ui_update",
    description: "Low priority",
    priority: "low",
    continueOnFailure: false,
    execute: async () => { executionOrder.push("low"); },
  });

  scope.addEffect({
    id: "effect_critical",
    type: "ui_update",
    description: "Critical priority",
    priority: "critical",
    continueOnFailure: false,
    execute: async () => { executionOrder.push("critical"); },
  });

  scope.addEffect({
    id: "effect_normal",
    type: "ui_update",
    description: "Normal priority",
    priority: "normal",
    continueOnFailure: false,
    execute: async () => { executionOrder.push("normal"); },
  });

  scope.commit();
  await scope.executeEffects();

  assert.deepStrictEqual(executionOrder, ["critical", "normal", "low"]);
});

test("EffectScope compensateEffects runs compensation in reverse", async () => {
  const compensationOrder: string[] = [];
  const scope = new EffectScope({
    scopeId: "test_scope_13",
  });

  scope.addEffect({
    id: "effect_1",
    type: "event_publish",
    description: "Effect 1",
    priority: "normal",
    continueOnFailure: false,
    execute: async () => {},
    compensate: async () => { compensationOrder.push("effect_1"); },
  });

  scope.addEffect({
    id: "effect_2",
    type: "event_publish",
    description: "Effect 2",
    priority: "normal",
    continueOnFailure: false,
    execute: async () => {},
    compensate: async () => { compensationOrder.push("effect_2"); },
  });

  scope.commit();
  await scope.executeEffects();

  const results = [
    { effectId: "effect_1", success: true, durationMs: 1, type: "event_publish" as const },
    { effectId: "effect_2", success: true, durationMs: 1, type: "event_publish" as const },
  ];

  await scope.compensateEffects(results);

  assert.deepStrictEqual(compensationOrder, ["effect_2", "effect_1"]);
});

test("EffectBuffer createScope creates and stores scopes", () => {
  const buffer = new EffectBuffer();

  const scope1 = buffer.createScope({ scopeId: "scope_1" });
  const scope2 = buffer.createScope({ scopeId: "scope_2" });

  assert.ok(buffer.getScope("scope_1") === scope1);
  assert.ok(buffer.getScope("scope_2") === scope2);
  assert.equal(buffer.getScopeCount(), 2);
});

test("EffectBuffer getScope returns undefined for non-existent scope", () => {
  const buffer = new EffectBuffer();
  assert.equal(buffer.getScope("nonexistent"), undefined);
});

test("EffectBuffer removeScope removes scope", () => {
  const buffer = new EffectBuffer();

  buffer.createScope({ scopeId: "to_remove" });
  assert.equal(buffer.getScopeCount(), 1);

  buffer.removeScope("to_remove");
  assert.equal(buffer.getScopeCount(), 0);
  assert.equal(buffer.getScope("to_remove"), undefined);
});

test("EffectBuffer flush executes all committed scopes", async () => {
  let executed = false;
  const buffer = new EffectBuffer();

  const scope = buffer.createScope({ scopeId: "flush_test" });
  scope.add("event_publish", "Test", async () => { executed = true; });
  scope.commit();

  const results = await buffer.flush();

  assert.equal(results.length, 1);
  assert.equal(executed, true);
});

test("EffectBuffer flush skips rolled back scopes", async () => {
  const buffer = new EffectBuffer();

  const scope = buffer.createScope({ scopeId: "rollback_skip" });
  scope.add("event_publish", "Test", async () => {});
  scope.rollback();

  const results = await buffer.flush();

  assert.equal(results.length, 0);
});

test("EffectBuffer flush skips uncommitted scopes", async () => {
  const buffer = new EffectBuffer();

  const scope = buffer.createScope({ scopeId: "uncommitted_skip" });
  scope.add("event_publish", "Test", async () => {});

  const results = await buffer.flush();

  assert.equal(results.length, 0);
});

test("EffectBuffer clear removes all scopes", () => {
  const buffer = new EffectBuffer();

  buffer.createScope({ scopeId: "scope_a" });
  buffer.createScope({ scopeId: "scope_b" });
  assert.equal(buffer.getScopeCount(), 2);

  buffer.clear();
  assert.equal(buffer.getScopeCount(), 0);
});

test("EffectScope getCreatedAt returns timestamp", () => {
  const before = Date.now();
  const scope = new EffectScope({ scopeId: "timestamp_test" });
  const after = Date.now();

  const createdAt = scope.getCreatedAt();
  assert.ok(createdAt >= before);
  assert.ok(createdAt <= after);
});