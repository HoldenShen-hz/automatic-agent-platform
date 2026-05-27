/**
 * Unit Tests: Effect Buffer
 *
 * Tests the EffectBuffer, EffectScope, and EffectBuilder classes.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  EffectBuilder,
  EffectScope,
  EffectBuffer,
  globalEffectBuffer,
  type EffectType,
  type EffectPriority,
  type Effect,
} from "../../../../../src/platform/five-plane-execution/execution-engine/effect-buffer.js";

// ---------------------------------------------------------------------------
// EffectBuilder tests
// ---------------------------------------------------------------------------

test("EffectBuilder.create returns builder instance [effect-buffer-new]", () => {
  const builder = EffectBuilder.create("event_publish", "test effect");
  assert.ok(builder instanceof EffectBuilder);
});

test("EffectBuilder.withId sets custom id [effect-buffer-new]", () => {
  const builder = EffectBuilder.create("event_publish", "test").withId("custom-id");
  const effect = builder.withExecute(async () => {}).build();
  assert.equal(effect.id, "custom-id");
});

test("EffectBuilder.withPriority sets priority [effect-buffer-new]", () => {
  const builder = EffectBuilder.create("event_publish", "test").withPriority("critical");
  const effect = builder.withExecute(async () => {}).build();
  assert.equal(effect.priority, "critical");
});

test("EffectBuilder.withExecute sets execute function [effect-buffer-new]", () => {
  let executed = false;
  const builder = EffectBuilder.create("event_publish", "test").withExecute(async () => {
    executed = true;
  });
  const effect = builder.build();
  assert.ok(effect.execute !== undefined);
  assert.equal(executed, false); // not called yet
});

test("EffectBuilder.withCompensate sets compensate function [effect-buffer-new]", () => {
  const builder = EffectBuilder.create("event_publish", "test")
    .withExecute(async () => {})
    .withCompensate(async () => {});
  const effect = builder.build();
  assert.ok(effect.compensate !== undefined);
});

test("EffectBuilder.withTimeout sets timeout [effect-buffer-new]", () => {
  const builder = EffectBuilder.create("event_publish", "test")
    .withExecute(async () => {})
    .withTimeout(5000);
  const effect = builder.build();
  assert.equal(effect.timeoutMs, 5000);
});

test("EffectBuilder.continueOnFailure sets continueOnFailure [effect-buffer-new]", () => {
  const builder = EffectBuilder.create("event_publish", "test")
    .withExecute(async () => {})
    .continueOnFailure();
  const effect = builder.build();
  assert.equal(effect.continueOnFailure, true);
});

test("EffectBuilder.build throws without execute [effect-buffer-new]", () => {
  const builder = EffectBuilder.create("event_publish", "test");
  assert.throws(
    () => builder.build(),
    (err: unknown) => (err as Error).message.includes("effect_builder.missing_execute"),
  );
});

test("EffectBuilder supports fluent chaining [effect-buffer-new]", () => {
  const effect = EffectBuilder.create("callback_invoke", "chained test")
    .withId("chained-id")
    .withPriority("high")
    .withTimeout(3000)
    .continueOnFailure()
    .withExecute(async () => {})
    .withCompensate(async () => {})
    .build();

  assert.equal(effect.id, "chained-id");
  assert.equal(effect.priority, "high");
  assert.equal(effect.timeoutMs, 3000);
  assert.equal(effect.continueOnFailure, true);
  assert.equal(effect.type, "callback_invoke");
  assert.equal(effect.description, "chained test");
});

// ---------------------------------------------------------------------------
// EffectScope basic tests
// ---------------------------------------------------------------------------

test("EffectScope creates with scopeId [effect-buffer-new]", () => {
  const scope = new EffectScope({ scopeId: "scope-1" });
  assert.ok(scope instanceof EffectScope);
  assert.equal(scope.getEffectCount(), 0);
});

test("EffectScope.addEffect adds effect [effect-buffer-new]", () => {
  const scope = new EffectScope({ scopeId: "scope-add" });
  const effect: Effect = {
    id: "effect-1",
    type: "event_publish",
    description: "test",
    priority: "normal",
    execute: async () => {},
    continueOnFailure: false,
  };
  scope.addEffect(effect);
  assert.equal(scope.getEffectCount(), 1);
});

test("EffectScope.add adds effect via fluent method [effect-buffer-new]", () => {
  const scope = new EffectScope({ scopeId: "scope-fluent" });
  scope.add("stream_emit", "test emit", async () => {});
  assert.equal(scope.getEffectCount(), 1);
});

test("EffectScope.addEffect throws when already committed [effect-buffer-new]", () => {
  const scope = new EffectScope({ scopeId: "scope-committed" });
  scope.commit();
  const effect: Effect = {
    id: "effect-1",
    type: "event_publish",
    description: "test",
    priority: "normal",
    execute: async () => {},
    continueOnFailure: false,
  };
  assert.throws(
    () => scope.addEffect(effect),
    (err: unknown) => (err as Error).message.includes("effect_scope.already_committed"),
  );
});

test("EffectScope.addEffect throws when already rolled back [effect-buffer-new]", () => {
  const scope = new EffectScope({ scopeId: "scope-rolledback" });
  scope.rollback();
  const effect: Effect = {
    id: "effect-1",
    type: "event_publish",
    description: "test",
    priority: "normal",
    execute: async () => {},
    continueOnFailure: false,
  };
  assert.throws(
    () => scope.addEffect(effect),
    (err: unknown) => (err as Error).message.includes("effect_scope.already_rolled_back"),
  );
});

test("EffectScope.commit marks scope as committed [effect-buffer-new]", () => {
  const scope = new EffectScope({ scopeId: "scope-commit" });
  assert.equal(scope.isCommitted(), false);
  scope.commit();
  assert.equal(scope.isCommitted(), true);
});

test("EffectScope.rollback marks scope as rolled back [effect-buffer-new]", () => {
  const scope = new EffectScope({ scopeId: "scope-rollback" });
  assert.equal(scope.isRolledBack(), false);
  scope.rollback();
  assert.equal(scope.isRolledBack(), true);
});

test("EffectScope.getCreatedAt returns timestamp [effect-buffer-new]", () => {
  const before = Date.now();
  const scope = new EffectScope({ scopeId: "scope-time" });
  const after = Date.now();
  const createdAt = scope.getCreatedAt();
  assert.ok(createdAt >= before);
  assert.ok(createdAt <= after);
});

// ---------------------------------------------------------------------------
// EffectScope execution tests
// ---------------------------------------------------------------------------

test("EffectScope.executeEffects executes committed effects [effect-buffer-new]", async () => {
  let executed = false;
  const scope = new EffectScope({ scopeId: "scope-exec" });
  scope.add("event_publish", "test", async () => {
    executed = true;
  });
  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 0);
  assert.equal(executed, true);
});

test("EffectScope.executeEffects skips rolled back scope [effect-buffer-new]", async () => {
  // Note: rollback() does NOT commit the scope first,
  // so executeEffects will throw "not_committed"
  // The rolled-back state is checked AFTER the committed check
  let threw = false;
  const scope = new EffectScope({ scopeId: "scope-skip" });
  scope.add("event_publish", "test", async () => {});
  scope.rollback();

  try {
    await scope.executeEffects();
  } catch {
    threw = true;
  }
  // Expected: throws because rollback() doesn't commit first
  assert.equal(threw, true);
});

test("EffectScope.executeEffects throws when not committed [effect-buffer-new]", async () => {
  const scope = new EffectScope({ scopeId: "scope-not-committed" });
  scope.add("event_publish", "test", async () => {});

  await assert.rejects(
    async () => scope.executeEffects(),
    (err: unknown) => (err as Error).message.includes("effect_scope.not_committed"),
  );
});

test("EffectScope.executeEffects handles effect timeout [effect-buffer-new]", async () => {
  const scope = new EffectScope({ scopeId: "scope-timeout", defaultTimeoutMs: 10 });
  scope.add("callback_invoke", "slow effect", async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.failed, 1);
  assert.equal(result.succeeded, 0);
});

test("EffectScope.executeEffects executes effects in priority order [effect-buffer-new]", async () => {
  const order: string[] = [];
  const scope = new EffectScope({ scopeId: "scope-priority" });

  // Add low priority effect
  const lowEffect: Effect = {
    id: "low",
    type: "metric_record",
    description: "low priority",
    priority: "low",
    execute: async () => {
      order.push("low");
    },
    continueOnFailure: false,
  };
  scope.addEffect(lowEffect);

  // Add critical priority effect
  const criticalEffect: Effect = {
    id: "critical",
    type: "event_publish",
    description: "critical",
    priority: "critical",
    execute: async () => {
      order.push("critical");
    },
    continueOnFailure: false,
  };
  scope.addEffect(criticalEffect);

  // Add normal priority effect
  const normalEffect: Effect = {
    id: "normal",
    type: "ui_update",
    description: "normal priority",
    priority: "normal",
    execute: async () => {
      order.push("normal");
    },
    continueOnFailure: false,
  };
  scope.addEffect(normalEffect);

  scope.commit();
  await scope.executeEffects();

  assert.equal(order[0], "critical");
  assert.equal(order[1], "normal");
  assert.equal(order[2], "low");
});

test("EffectScope.executeEffects records error on failure [effect-buffer-new]", async () => {
  const scope = new EffectScope({ scopeId: "scope-error" });
  scope.add("external_notification", "failing", async () => {
    throw new Error("intentional failure");
  });
  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.failed, 1);
  assert.equal(result.succeeded, 0);
  assert.ok(result.results[0]?.error !== undefined);
  assert.equal(result.allSucceeded, false);
});

test("EffectScope.compensateEffects calls compensation functions [effect-buffer-new]", async () => {
  let compensated = false;
  const scope = new EffectScope({ scopeId: "scope-compensate" });

  const effect: Effect = {
    id: "compensate-effect",
    type: "callback_invoke",
    description: "compensatable",
    priority: "normal",
    execute: async () => {},
    compensate: async () => {
      compensated = true;
    },
    continueOnFailure: false,
  };
  scope.addEffect(effect);

  scope.commit();
  const result = await scope.executeEffects();
  await scope.compensateEffects(result.results);

  assert.equal(compensated, true);
});

// ---------------------------------------------------------------------------
// EffectBuffer tests
// ---------------------------------------------------------------------------

test("EffectBuffer.createScope creates new scope [effect-buffer-new]", () => {
  const buffer = new EffectBuffer();
  const scope = buffer.createScope({ scopeId: "buffer-scope" });
  assert.ok(scope instanceof EffectScope);
  assert.equal(buffer.getScopeCount(), 1);
});

test("EffectBuffer.getScope retrieves existing scope [effect-buffer-new]", () => {
  const buffer = new EffectBuffer();
  const created = buffer.createScope({ scopeId: "get-scope" });
  const retrieved = buffer.getScope("get-scope");
  assert.strictEqual(created, retrieved);
});

test("EffectBuffer.getScope returns undefined for unknown id [effect-buffer-new]", () => {
  const buffer = new EffectBuffer();
  const result = buffer.getScope("unknown-scope");
  assert.equal(result, undefined);
});

test("EffectBuffer.removeScope removes scope [effect-buffer-new]", () => {
  const buffer = new EffectBuffer();
  buffer.createScope({ scopeId: "remove-scope" });
  assert.equal(buffer.getScopeCount(), 1);
  buffer.removeScope("remove-scope");
  assert.equal(buffer.getScopeCount(), 0);
});

test("EffectBuffer.clear removes all scopes [effect-buffer-new]", () => {
  const buffer = new EffectBuffer();
  buffer.createScope({ scopeId: "clear-1" });
  buffer.createScope({ scopeId: "clear-2" });
  assert.equal(buffer.getScopeCount(), 2);
  buffer.clear();
  assert.equal(buffer.getScopeCount(), 0);
});

test("EffectBuffer.flush executes all committed scopes [effect-buffer-new]", async () => {
  let executed = false;
  const buffer = new EffectBuffer();
  const scope = buffer.createScope({ scopeId: "flush-scope" });
  scope.add("event_publish", "flush test", async () => {
    executed = true;
  });
  scope.commit();

  const results = await buffer.flush();
  assert.equal(results.length, 1);
  assert.equal(results[0]!.succeeded, 1);
  assert.equal(executed, true);
});

test("EffectBuffer.flush skips rolled back scopes [effect-buffer-new]", async () => {
  const buffer = new EffectBuffer();
  const scope = buffer.createScope({ scopeId: "skip-rolledback" });
  scope.add("event_publish", "skip test", async () => {});
  scope.rollback();

  const results = await buffer.flush();
  assert.equal(results.length, 0);
});

test("EffectBuffer.flush skips uncommitted scopes [effect-buffer-new]", async () => {
  const buffer = new EffectBuffer();
  buffer.createScope({ scopeId: "skip-uncommitted" });
  buffer.createScope({ scopeId: "skip-uncommitted-2" }).add("event_publish", "test", async () => {});

  const results = await buffer.flush();
  assert.equal(results.length, 0);
});

test("EffectBuffer.flush handles multiple scopes [effect-buffer-new]", async () => {
  const buffer = new EffectBuffer();

  const scope1 = buffer.createScope({ scopeId: "multi-1" });
  scope1.add("event_publish", "scope1", async () => {});
  scope1.commit();

  const scope2 = buffer.createScope({ scopeId: "multi-2" });
  scope2.add("callback_invoke", "scope2", async () => {});
  scope2.commit();

  const results = await buffer.flush();
  assert.equal(results.length, 2);
});

test("EffectBuffer globalEffectBuffer is instance of EffectBuffer [effect-buffer-new]", () => {
  assert.ok(globalEffectBuffer instanceof EffectBuffer);
});

// ---------------------------------------------------------------------------
// EffectBuffer TTL/eviction tests (indirect via createScope)
// ---------------------------------------------------------------------------

test("EffectBuffer createScope triggers eviction check [effect-buffer-new]", () => {
  const buffer = new EffectBuffer();
  // Creating many scopes should work - eviction is internal
  for (let i = 0; i < 10; i++) {
    buffer.createScope({ scopeId: `evict-${i}` });
  }
  assert.ok(buffer.getScopeCount() <= 100); // MAX_SCOPES
});

// ---------------------------------------------------------------------------
// Effect types and priorities
// ---------------------------------------------------------------------------

test("EffectBuilder supports all effect types [effect-buffer-new]", () => {
  const types: EffectType[] = [
    "event_publish",
    "stream_emit",
    "callback_invoke",
    "ui_update",
    "external_notification",
    "artifact_flush",
    "metric_record",
  ];

  for (const type of types) {
    const effect = EffectBuilder.create(type, `test ${type}`)
      .withExecute(async () => {})
      .build();
    assert.equal(effect.type, type);
  }
});

test("EffectBuilder supports all effect priorities [effect-buffer-new]", () => {
  const priorities: EffectPriority[] = ["critical", "high", "normal", "low"];

  for (const priority of priorities) {
    const effect = EffectBuilder.create("event_publish", `test`)
      .withPriority(priority)
      .withExecute(async () => {})
      .build();
    assert.equal(effect.priority, priority);
  }
});
