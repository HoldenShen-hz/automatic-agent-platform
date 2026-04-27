import assert from "node:assert/strict";
import test from "node:test";

import { EffectBuffer, EffectScope, EffectBuilder, EffectPriority } from "../../../../src/platform/execution/execution-engine/effect-buffer.js";

test("EffectBuilder creates effect with required fields", () => {
  const effect = EffectBuilder.create("event_publish", "test effect")
    .withExecute(async () => {})
    .build();

  assert.equal(effect.type, "event_publish");
  assert.equal(effect.description, "test effect");
  assert.equal(effect.priority, "normal");
  assert.equal(effect.continueOnFailure, false);
});

test("EffectBuilder throws when execute function is missing", () => {
  assert.throws(
    () => EffectBuilder.create("event_publish", "test effect").build(),
    /effect_builder.missing_execute/,
  );
});

test("EffectBuilder supports fluent API for all options", () => {
  const effect = EffectBuilder.create("callback_invoke", "api call")
    .withId("custom-id")
    .withPriority("high")
    .withTimeout(5000)
    .withExecute(async () => {})
    .withCompensate(async () => {})
    .continueOnFailure()
    .build();

  assert.equal(effect.id, "custom-id");
  assert.equal(effect.priority, "high");
  assert.equal(effect.timeoutMs, 5000);
  assert.equal(effect.continueOnFailure, true);
  assert.ok(effect.compensate != null);
});

test("EffectScope addEffect rejects effects after commit", async () => {
  const scope = new EffectScope({ scopeId: "scope-1" });
  scope.addEffect(
    EffectBuilder.create("event_publish", "test").withExecute(async () => {}).build(),
  );
  scope.commit();

  await assert.rejects(
    async () => {
      scope.addEffect(
        EffectBuilder.create("event_publish", "late").withExecute(async () => {}).build(),
      );
    },
    /effect_scope.already_committed/,
  );
});

test("EffectScope addEffect rejects effects after rollback", () => {
  const scope = new EffectScope({ scopeId: "scope-1" });
  scope.rollback();

  assert.throws(
    () => {
      scope.addEffect(
        EffectBuilder.create("event_publish", "test").withExecute(async () => {}).build(),
      );
    },
    /effect_scope.already_rolled_back/,
  );
});

test("EffectScope commit sets committed flag", () => {
  const scope = new EffectScope({ scopeId: "scope-1" });
  assert.equal(scope.isCommitted(), false);
  scope.commit();
  assert.equal(scope.isCommitted(), true);
});

test("EffectScope rollback sets rolledBack flag", () => {
  const scope = new EffectScope({ scopeId: "scope-1" });
  assert.equal(scope.isRolledBack(), false);
  scope.rollback();
  assert.equal(scope.isRolledBack(), true);
});

test("EffectScope executeEffects rejects if not committed", async () => {
  const scope = new EffectScope({ scopeId: "scope-1" });

  await assert.rejects(
    async () => scope.executeEffects(),
    /effect_scope.not_committed/,
  );
});

test("EffectScope executeEffects returns skipped results if rolled back", async () => {
  const scope = new EffectScope({ scopeId: "scope-1" });
  scope.addEffect(
    EffectBuilder.create("event_publish", "test").withExecute(async () => {}).build(),
  );
  scope.commit();
  scope.rollback();

  const result = await scope.executeEffects();
  assert.equal(result.skipped, 1);
  assert.equal(result.succeeded, 0);
  assert.equal(result.failed, 0);
  assert.equal(result.allSucceeded, true);
});

test("EffectScope executeEffects runs effects in priority order", async () => {
  const scope = new EffectScope({ scopeId: "scope-1" });
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
    EffectBuilder.create("event_publish", "critical")
      .withPriority("critical")
      .withExecute(async () => {
        executionOrder.push("critical");
      })
      .build(),
  );
  scope.addEffect(
    EffectBuilder.create("event_publish", "high priority")
      .withPriority("high")
      .withExecute(async () => {
        executionOrder.push("high");
      })
      .build(),
  );
  scope.commit();

  await scope.executeEffects();
  assert.equal(executionOrder[0], "critical");
  assert.equal(executionOrder[1], "high");
  assert.equal(executionOrder[2], "low");
});

test("EffectScope executeEffects stops on failure when configured", async () => {
  const scope = new EffectScope({ scopeId: "scope-1", stopOnFailure: true });
  const executionOrder: string[] = [];

  scope.addEffect(
    EffectBuilder.create("event_publish", "first")
      .withPriority("critical")
      .withExecute(async () => {
        executionOrder.push("first");
      })
      .build(),
  );
  scope.addEffect(
    EffectBuilder.create("event_publish", "fail")
      .withPriority("high")
      .withExecute(async () => {
        executionOrder.push("fail");
        throw new Error("intentional failure");
      })
      .build(),
  );
  scope.addEffect(
    EffectBuilder.create("event_publish", "second")
      .withPriority("normal")
      .withExecute(async () => {
        executionOrder.push("second");
      })
      .build(),
  );
  scope.commit();

  const result = await scope.executeEffects();
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.allSucceeded, false);
  assert.deepEqual(executionOrder, ["first", "fail"]);
});

test("EffectScope executeEffects continues on failure when continueOnFailure is set", async () => {
  const scope = new EffectScope({ scopeId: "scope-1", stopOnFailure: true });
  const executionOrder: string[] = [];

  scope.addEffect(
    EffectBuilder.create("event_publish", "first")
      .withExecute(async () => {
        executionOrder.push("first");
      })
      .build(),
  );
  scope.addEffect(
    EffectBuilder.create("event_publish", "fail-but-continue")
      .continueOnFailure()
      .withExecute(async () => {
        executionOrder.push("fail");
        throw new Error("intentional failure");
      })
      .build(),
  );
  scope.addEffect(
    EffectBuilder.create("event_publish", "second")
      .withExecute(async () => {
        executionOrder.push("second");
      })
      .build(),
  );
  scope.commit();

  const result = await scope.executeEffects();
  assert.equal(result.succeeded, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.allSucceeded, false);
  assert.deepEqual(executionOrder, ["first", "fail", "second"]);
});

test("EffectScope executeEffects respects custom timeout", async () => {
  const scope = new EffectScope({ scopeId: "scope-1", defaultTimeoutMs: 10 });

  scope.addEffect(
    EffectBuilder.create("event_publish", "slow effect")
      .withTimeout(5)
      .withExecute(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      })
      .build(),
  );
  scope.commit();

  const result = await scope.executeEffects();
  assert.equal(result.failed, 1);
  assert.ok(result.results[0]?.error?.message.includes("effect.timeout"));
});

test("EffectScope compensateEffects runs compensation in reverse order", async () => {
  const scope = new EffectScope({ scopeId: "scope-1" });
  const compensationOrder: string[] = [];

  scope.addEffect(
    EffectBuilder.create("event_publish", "first")
      .withExecute(async () => {})
      .withCompensate(async () => {
        compensationOrder.push("first");
      })
      .build(),
  );
  scope.addEffect(
    EffectBuilder.create("event_publish", "second")
      .withExecute(async () => {})
      .withCompensate(async () => {
        compensationOrder.push("second");
      })
      .build(),
  );
  scope.commit();

  const results = await scope.executeEffects();
  await scope.compensateEffects(results.results);

  assert.deepEqual(compensationOrder, ["second", "first"]);
});

test("EffectBuffer createScope creates new scope", () => {
  const buffer = new EffectBuffer();
  const scope = buffer.createScope({ scopeId: "new-scope" });

  assert.equal(scope.getEffectCount(), 0);
  assert.equal(buffer.getScopeCount(), 1);
});

test("EffectBuffer getScope returns existing scope", () => {
  const buffer = new EffectBuffer();
  const created = buffer.createScope({ scopeId: "test-scope" });
  const retrieved = buffer.getScope("test-scope");

  assert.equal(retrieved, created);
});

test("EffectBuffer getScope returns undefined for non-existent scope", () => {
  const buffer = new EffectBuffer();
  const retrieved = buffer.getScope("non-existent");

  assert.equal(retrieved, undefined);
});

test("EffectBuffer removeScope deletes scope", () => {
  const buffer = new EffectBuffer();
  buffer.createScope({ scopeId: "to-remove" });
  assert.equal(buffer.getScopeCount(), 1);

  buffer.removeScope("to-remove");
  assert.equal(buffer.getScopeCount(), 0);
});

test("EffectBuffer flush executes all committed scopes", async () => {
  const buffer = new EffectBuffer();
  const scope1 = buffer.createScope({ scopeId: "scope-1" });
  const scope2 = buffer.createScope({ scopeId: "scope-2" });
  const executed: string[] = [];

  scope1.add(
    "event_publish",
    "scope1 effect",
    async () => { executed.push("scope1"); },
  );
  scope1.commit();

  scope2.add(
    "event_publish",
    "scope2 effect",
    async () => { executed.push("scope2"); },
  );
  scope2.commit();

  const results = await buffer.flush();
  assert.equal(results.length, 2);
  assert.ok(executed.includes("scope1"));
  assert.ok(executed.includes("scope2"));
});

test("EffectBuffer flush skips rolled back scopes", async () => {
  const buffer = new EffectBuffer();
  const scope = buffer.createScope({ scopeId: "rolled-back" });

  scope.add(
    "event_publish",
    "should not run",
    async () => { throw new Error("should not be called"); },
  );
  scope.rollback();

  const results = await buffer.flush();
  assert.equal(results.length, 0);
});

test("EffectBuffer flush skips non-committed scopes", async () => {
  const buffer = new EffectBuffer();
  const scope = buffer.createScope({ scopeId: "not-committed" });

  scope.add(
    "event_publish",
    "should not run",
    async () => { throw new Error("should not be called"); },
  );

  const results = await buffer.flush();
  assert.equal(results.length, 0);
});

test("EffectBuffer clear removes all scopes", () => {
  const buffer = new EffectBuffer();
  buffer.createScope({ scopeId: "scope-1" });
  buffer.createScope({ scopeId: "scope-2" });
  assert.equal(buffer.getScopeCount(), 2);

  buffer.clear();
  assert.equal(buffer.getScopeCount(), 0);
});

test("EffectScope add is fluent and returns self", () => {
  const scope = new EffectScope({ scopeId: "scope-1" });
  const result = scope.add("event_publish", "test", async () => {});

  assert.equal(result, scope);
  assert.equal(scope.getEffectCount(), 1);
});

test("EffectScope getCreatedAt returns timestamp", () => {
  const scope = new EffectScope({ scopeId: "scope-1" });
  const before = Date.now();

  assert.ok(scope.getCreatedAt() >= before);
});
