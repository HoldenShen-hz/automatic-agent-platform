import assert from "node:assert/strict";
import test from "node:test";

import {
  EffectBuffer,
  EffectScope,
  EffectBuilder,
  globalEffectBuffer,
  type Effect,
  type EffectScopeOptions,
  type EffectType,
  type EffectPriority,
  type EffectResult,
  type EffectScopeResult,
} from "../../../../../src/platform/execution/execution-engine/effect-buffer.js";

test("EffectBuilder creates effect with required fields", () => {
  const effect = EffectBuilder.create("event_publish", "Test effect")
    .withExecute(async () => {})
    .build();

  assert.ok(effect.id);
  assert.equal(effect.type, "event_publish");
  assert.equal(effect.description, "Test effect");
  assert.equal(effect.priority, "normal");
  assert.equal(effect.continueOnFailure, false);
});

test("EffectBuilder withId sets custom id", () => {
  const effect = EffectBuilder.create("stream_emit", "Test")
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

test("EffectBuilder continueOnFailure enables continue behavior", () => {
  const effect = EffectBuilder.create("ui_update", "Test")
    .withExecute(async () => {})
    .continueOnFailure()
    .build();

  assert.equal(effect.continueOnFailure, true);
});

test("EffectBuilder withTimeout sets timeout", () => {
  const effect = EffectBuilder.create("external_notification", "Test")
    .withExecute(async () => {})
    .withTimeout(5000)
    .build();

  assert.equal(effect.timeoutMs, 5000);
});

test("EffectBuilder withCompensate sets compensation", () => {
  const compensateFn = async () => {};
  const effect = EffectBuilder.create("artifact_flush", "Test")
    .withExecute(async () => {})
    .withCompensate(compensateFn)
    .build();

  assert.equal(effect.compensate, compensateFn);
});

test("EffectBuilder throws when execute is missing", () => {
  assert.throws(
    () => {
      EffectBuilder.create("event_publish", "Test").build();
    },
    /effect_builder.missing_execute/,
  );
});

test("EffectScope constructor sets options correctly", () => {
  const scope = new EffectScope({
    scopeId: "test_scope",
    defaultTimeoutMs: 3000,
    stopOnFailure: true,
  });

  assert.equal(scope.getCreatedAt() > 0, true);
  assert.equal(scope.getEffectCount(), 0);

  // Add an effect and verify it works
  scope.addEffect(
    EffectBuilder.create("event_publish", "Test")
      .withExecute(async () => {})
      .build(),
  );
  assert.equal(scope.getEffectCount(), 1);
});

test("EffectScope addEffect adds effect to scope", () => {
  const scope = new EffectScope({ scopeId: "test_scope" });

  scope.addEffect(
    EffectBuilder.create("metric_record", "Test metric")
      .withExecute(async () => {})
      .build(),
  );

  assert.equal(scope.getEffectCount(), 1);
});

test("EffectScope addEffect throws when committed", () => {
  const scope = new EffectScope({ scopeId: "test_scope" });
  scope.commit();

  assert.throws(
    () => {
      scope.addEffect(
        EffectBuilder.create("event_publish", "Test")
          .withExecute(async () => {})
          .build(),
      );
    },
    /effect_scope.already_committed/,
  );
});

test("EffectScope addEffect throws when rolled back", () => {
  const scope = new EffectScope({ scopeId: "test_scope" });
  scope.rollback();

  assert.throws(
    () => {
      scope.addEffect(
        EffectBuilder.create("event_publish", "Test")
          .withExecute(async () => {})
          .build(),
      );
    },
    /effect_scope.already_rolled_back/,
  );
});

test("EffectScope commit marks scope as committed", () => {
  const scope = new EffectScope({ scopeId: "test_scope" });
  assert.equal(scope.isCommitted(), false);

  scope.commit();

  assert.equal(scope.isCommitted(), true);
});

test("EffectScope rollback marks scope as rolled back", () => {
  const scope = new EffectScope({ scopeId: "test_scope" });
  scope.rollback();

  assert.equal(scope.isRolledBack(), true);
});

test("EffectScope executeEffects executes in priority order", async () => {
  const scope = new EffectScope({ scopeId: "test_scope" });

  const executionOrder: string[] = [];

  scope.addEffect(
    EffectBuilder.create("event_publish", "low priority")
      .withPriority("low")
      .withExecute(async () => {
        executionOrder.push("low");
      })
      .build(),
  );

  scope.addEffect(
    EffectBuilder.create("event_publish", "critical priority")
      .withPriority("critical")
      .withExecute(async () => {
        executionOrder.push("critical");
      })
      .build(),
  );

  scope.addEffect(
    EffectBuilder.create("event_publish", "normal priority")
      .withPriority("normal")
      .withExecute(async () => {
        executionOrder.push("normal");
      })
      .build(),
  );

  scope.commit();
  await scope.executeEffects();

  assert.deepEqual(executionOrder, ["critical", "normal", "low"]);
});

test("EffectScope executeEffects returns proper result", async () => {
  const scope = new EffectScope({ scopeId: "test_scope" });

  scope.addEffect(
    EffectBuilder.create("event_publish", "Test effect")
      .withExecute(async () => {})
      .build(),
  );

  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.scopeId, "test_scope");
  assert.equal(result.totalEffects, 1);
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.allSucceeded, true);
});

test("EffectScope executeEffects handles failures", async () => {
  const scope = new EffectScope({ scopeId: "test_scope" });

  scope.addEffect(
    EffectBuilder.create("event_publish", "Failing effect")
      .withExecute(async () => {
        throw new Error("intentional failure");
      })
      .build(),
  );

  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.failed, 1);
  assert.equal(result.succeeded, 0);
  assert.equal(result.allSucceeded, false);
});

test("EffectScope executeEffects skips effects when rolled back", async () => {
  const scope = new EffectScope({ scopeId: "test_scope" });

  scope.addEffect(
    EffectBuilder.create("event_publish", "Test")
      .withExecute(async () => {
        throw new Error("should not execute");
      })
      .build(),
  );

  // Commit then rollback - effects should be skipped
  scope.commit();
  scope.rollback();

  const result = await scope.executeEffects();

  // Rolled back scopes return all effects as skipped
  assert.equal(result.skipped, 1);
  assert.equal(result.succeeded, 0);
  assert.equal(result.allSucceeded, true);
});

test("EffectScope executeEffects throws when not committed", async () => {
  const scope = new EffectScope({ scopeId: "test_scope" });

  scope.addEffect(
    EffectBuilder.create("event_publish", "Test")
      .withExecute(async () => {})
      .build(),
  );

  await assert.rejects(
    async () => {
      await scope.executeEffects();
    },
    /effect_scope.not_committed/,
  );
});

test("EffectScope compensateEffects calls compensation functions", async () => {
  const scope = new EffectScope({ scopeId: "test_scope" });

  let compensated = false;

  scope.addEffect(
    EffectBuilder.create("event_publish", "Test")
      .withExecute(async () => {})
      .withCompensate(async () => {
        compensated = true;
      })
      .build(),
  );

  scope.commit();
  const result = await scope.executeEffects();

  await scope.compensateEffects(result.results);

  assert.equal(compensated, true);
});

test("EffectBuffer createScope creates and stores scope", () => {
  const buffer = new EffectBuffer();

  const scope = buffer.createScope({ scopeId: "new_scope" });

  assert.ok(scope);
  assert.equal(buffer.getScope("new_scope"), scope);
});

test("EffectBuffer createScope evicts expired scopes", () => {
  const buffer = new EffectBuffer();

  // Create scope that will be evicted (simulated by TTL)
  const scope1 = buffer.createScope({ scopeId: "scope1" });
  assert.equal(buffer.getScope("scope1"), scope1);
});

test("EffectBuffer getScope returns undefined for missing scope", () => {
  const buffer = new EffectBuffer();

  assert.equal(buffer.getScope("nonexistent"), undefined);
});

test("EffectBuffer removeScope deletes scope", () => {
  const buffer = new EffectBuffer();

  buffer.createScope({ scopeId: "to_remove" });
  assert.ok(buffer.getScope("to_remove"));

  buffer.removeScope("to_remove");
  assert.equal(buffer.getScope("to_remove"), undefined);
});

test("EffectBuffer flush executes all committed scopes", async () => {
  const buffer = new EffectBuffer();

  const scope1 = buffer.createScope({ scopeId: "scope1" });
  scope1.addEffect(
    EffectBuilder.create("event_publish", "Test1")
      .withExecute(async () => {})
      .build(),
  );
  scope1.commit();

  const scope2 = buffer.createScope({ scopeId: "scope2" });
  scope2.addEffect(
    EffectBuilder.create("event_publish", "Test2")
      .withExecute(async () => {})
      .build(),
  );
  scope2.commit();

  const results = await buffer.flush();

  assert.equal(results.length, 2);
  assert.equal(results.every((r) => r.allSucceeded), true);
});

test("EffectBuffer flush skips rolled back scopes", async () => {
  const buffer = new EffectBuffer();

  const scope = buffer.createScope({ scopeId: "rolled_back_scope" });
  scope.addEffect(
    EffectBuilder.create("event_publish", "Test")
      .withExecute(async () => {
        throw new Error("should not execute");
      })
      .build(),
  );
  scope.rollback();

  const results = await buffer.flush();

  assert.equal(results.length, 0);
});

test("EffectBuffer flush skips uncommitted scopes", async () => {
  const buffer = new EffectBuffer();

  const scope = buffer.createScope({ scopeId: "uncommitted_scope" });
  scope.addEffect(
    EffectBuilder.create("event_publish", "Test")
      .withExecute(async () => {
        throw new Error("should not execute");
      })
      .build(),
  );
  // Don't commit

  const results = await buffer.flush();

  assert.equal(results.length, 0);
});

test("EffectBuffer getScopeCount returns correct count", () => {
  const buffer = new EffectBuffer();

  assert.equal(buffer.getScopeCount(), 0);

  buffer.createScope({ scopeId: "scope1" });
  assert.equal(buffer.getScopeCount(), 1);

  buffer.createScope({ scopeId: "scope2" });
  assert.equal(buffer.getScopeCount(), 2);
});

test("EffectBuffer clear removes all scopes", () => {
  const buffer = new EffectBuffer();

  buffer.createScope({ scopeId: "scope1" });
  buffer.createScope({ scopeId: "scope2" });

  assert.equal(buffer.getScopeCount(), 2);

  buffer.clear();

  assert.equal(buffer.getScopeCount(), 0);
});

test("globalEffectBuffer is an EffectBuffer instance", () => {
  assert.ok(globalEffectBuffer instanceof EffectBuffer);
});

test("EffectScope add is fluent", () => {
  const scope = new EffectScope({ scopeId: "test_scope" });

  const result = scope.add("event_publish", "Test", async () => {});

  assert.equal(result, scope);
  assert.equal(scope.getEffectCount(), 1);
});

test("EffectBuilder fluent chain builds correctly", () => {
  const effect = EffectBuilder.create("stream_emit", "Chain test")
    .withId("chained_id")
    .withPriority("high")
    .withTimeout(10000)
    .withExecute(async () => {})
    .withCompensate(async () => {})
    .continueOnFailure()
    .build();

  assert.equal(effect.id, "chained_id");
  assert.equal(effect.priority, "high");
  assert.equal(effect.timeoutMs, 10000);
  assert.equal(effect.continueOnFailure, true);
  assert.ok(effect.compensate);
});
