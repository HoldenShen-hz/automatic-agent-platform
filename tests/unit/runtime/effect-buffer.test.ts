import test from "node:test";
import assert from "node:assert/strict";

import {
  EffectBuilder,
  EffectScope,
  EffectBuffer,
  type EffectType,
  type EffectPriority,
} from "../../../src/platform/execution/execution-engine/effect-buffer.js";

test("EffectBuilder creates basic effect", () => {
  const effect = EffectBuilder.create("event_publish", "publish task event")
    .withExecute(async () => {})
    .build();

  assert.equal(effect.type, "event_publish");
  assert.equal(effect.description, "publish task event");
  assert.equal(effect.priority, "normal");
  assert.equal(effect.continueOnFailure, false);
  assert.ok(effect.id.startsWith("effect_"));
});

test("EffectBuilder requires execute function", () => {
  assert.throws(
    () => EffectBuilder.create("event_publish", "test").build(),
    /effect_builder.missing_execute/,
  );
});

test("EffectBuilder fluent API sets all options", () => {
  const effect = EffectBuilder.create("callback_invoke", "test callback")
    .withId("custom_id")
    .withPriority("high")
    .withTimeout(3000)
    .withCompensate(async () => {})
    .continueOnFailure()
    .withExecute(async () => {})
    .build();

  assert.equal(effect.id, "custom_id");
  assert.equal(effect.priority, "high");
  assert.equal(effect.timeoutMs, 3000);
  assert.equal(effect.continueOnFailure, true);
  assert.ok(effect.compensate != null);
});

test("EffectScope addEffect throws when already committed", () => {
  const scope = new EffectScope({ scopeId: "test" });
  scope.addEffect(EffectBuilder.create("event_publish", "e1").withExecute(async () => {}).build());
  scope.commit();
  assert.throws(
    () => scope.addEffect(EffectBuilder.create("event_publish", "e2").withExecute(async () => {}).build()),
    /effect_scope.already_committed/,
  );
});

test("EffectScope addEffect throws when rolled back", () => {
  const scope = new EffectScope({ scopeId: "test" });
  scope.rollback();
  assert.throws(
    () => scope.addEffect(EffectBuilder.create("event_publish", "e1").withExecute(async () => {}).build()),
    /effect_scope.already_rolled_back/,
  );
});

test("EffectScope commit and rollback both set their respective flags", async () => {
  const scope = new EffectScope({ scopeId: "test" });
  scope.commit();
  // commit() does NOT check rolledBack — it just sets committed
  assert.equal(scope.isCommitted(), true);
  assert.equal(scope.isRolledBack(), false);

  // rollback() after commit() just sets rolledBack (no throw)
  scope.rollback();
  assert.equal(scope.isCommitted(), true); // committed still true
  assert.equal(scope.isRolledBack(), true);

  // executeEffects skips when rolledBack (even if committed)
  const result = await scope.executeEffects();
  assert.equal(result.skipped, 0); // 0 because never had effects
});

test("EffectScope add convenience method", () => {
  const scope = new EffectScope({ scopeId: "test" });
  scope.add("metric_record", "record metric", async () => {});
  assert.equal(scope.getEffectCount(), 1);
});

test("EffectScope executeEffects throws when not committed", async () => {
  const scope = new EffectScope({ scopeId: "test" });
  scope.addEffect(EffectBuilder.create("event_publish", "e1")
    .withExecute(async () => {})
    .build());

  await assert.rejects(() => scope.executeEffects(), /effect_scope.not_committed/);
});

test("EffectScope executeEffects skips when committed then rolled back", async () => {
  const scope = new EffectScope({ scopeId: "test" });
  let executed = false;
  scope.addEffect(EffectBuilder.create("event_publish", "e1")
    .withExecute(async () => { executed = true; })
    .build());
  scope.commit();
  scope.rollback();

  const result = await scope.executeEffects();
  assert.equal(executed, false); // not executed because rolled back
  assert.equal(result.skipped, 1);
  assert.equal(result.allSucceeded, true); // skipped is not a failure
});

test("EffectScope executeEffects runs committed effects", async () => {
  const scope = new EffectScope({ scopeId: "test" });
  let executed = false;
  scope.addEffect(EffectBuilder.create("event_publish", "e1")
    .withExecute(async () => { executed = true; })
    .build());
  scope.commit();

  const result = await scope.executeEffects();
  assert.equal(executed, true);
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.allSucceeded, true);
});

test("EffectScope executeEffects respects priority order", async () => {
  const order: string[] = [];
  const scope = new EffectScope({ scopeId: "test" });

  scope.addEffect(EffectBuilder.create("event_publish", "low")
    .withPriority("low")
    .withExecute(async () => { order.push("low"); })
    .build());
  scope.addEffect(EffectBuilder.create("event_publish", "critical")
    .withPriority("critical")
    .withExecute(async () => { order.push("critical"); })
    .build());
  scope.addEffect(EffectBuilder.create("event_publish", "high")
    .withPriority("high")
    .withExecute(async () => { order.push("high"); })
    .build());

  scope.commit();
  await scope.executeEffects();

  assert.deepEqual(order, ["critical", "high", "low"]);
});

test("EffectScope executeEffects handles failure with continueOnFailure", async () => {
  const order: string[] = [];
  const scope = new EffectScope({ scopeId: "test" });

  scope.addEffect(EffectBuilder.create("event_publish", "first")
    .withExecute(async () => { order.push("first"); })
    .build());
  scope.addEffect(EffectBuilder.create("event_publish", "fails")
    .withExecute(async () => { throw new Error("planned error"); })
    .build());
  scope.addEffect(EffectBuilder.create("event_publish", "third")
    .withExecute(async () => { order.push("third"); })
    .build());

  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.succeeded, 2); // first and third
  assert.equal(result.failed, 1);   // fails
  assert.equal(result.allSucceeded, false);
});

test("EffectScope executeEffects handles effect timeout", async () => {
  const scope = new EffectScope({ scopeId: "test", defaultTimeoutMs: 50 });

  scope.addEffect(EffectBuilder.create("event_publish", "slow")
    .withTimeout(10)
    .withExecute(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    })
    .build());

  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.failed, 1);
  assert.equal(result.succeeded, 0);
  assert.ok(result.results[0]!.error!.message.includes("timeout"));
});

test("EffectScope compensateEffects calls compensate in reverse order", async () => {
  const order: string[] = [];
  const scope = new EffectScope({ scopeId: "test" });

  scope.addEffect(EffectBuilder.create("event_publish", "first")
    .withCompensate(async () => { order.push("compensate_first"); })
    .withExecute(async () => {})
    .build());
  scope.addEffect(EffectBuilder.create("event_publish", "second")
    .withCompensate(async () => { order.push("compensate_second"); })
    .withExecute(async () => {})
    .build());

  scope.commit();
  const execResult = await scope.executeEffects();

  await scope.compensateEffects(execResult.results);

  // Reverse order: second first, then first
  assert.deepEqual(order, ["compensate_second", "compensate_first"]);
});

test("EffectScope compensateEffects catches and logs compensate errors", async () => {
  const scope = new EffectScope({ scopeId: "test" });
  const logs: string[] = [];

  scope.addEffect(EffectBuilder.create("event_publish", "first")
    .withCompensate(async () => { throw new Error("compensate failed"); })
    .withExecute(async () => {})
    .build());
  scope.addEffect(EffectBuilder.create("event_publish", "second")
    .withCompensate(async () => { logs.push("second_compensated"); })
    .withExecute(async () => {})
    .build());

  scope.commit();
  const execResult = await scope.executeEffects();

  // compensateEffects should not throw even when one compensate fails
  // It should log and continue to the next effect
  await scope.compensateEffects(execResult.results);

  // Second compensate should still have been called (in reverse order, so first_compensated runs before second_compensated)
  // But since first throws, the order might be: first throws, then second runs
  // The exact behavior is that compensate continues despite errors
  assert.deepEqual(logs, ["second_compensated"]);
});

test("EffectBuffer createScope and getScope", () => {
  const buffer = new EffectBuffer();
  const scope = buffer.createScope({ scopeId: "scope1" });
  assert.ok(buffer.getScope("scope1") === scope);
  assert.equal(buffer.getScope("nonexistent"), undefined);
});

test("EffectBuffer removeScope", () => {
  const buffer = new EffectBuffer();
  buffer.createScope({ scopeId: "scope1" });
  buffer.removeScope("scope1");
  assert.equal(buffer.getScopeCount(), 0);
});

test("EffectBuffer flush executes committed scopes in order", async () => {
  const buffer = new EffectBuffer();
  const order: string[] = [];

  const scope1 = buffer.createScope({ scopeId: "scope1" });
  scope1.add("event_publish", "s1", async () => { order.push("s1"); });
  scope1.commit();

  const scope2 = buffer.createScope({ scopeId: "scope2" });
  scope2.add("event_publish", "s2", async () => { order.push("s2"); });
  scope2.commit();

  const results = await buffer.flush();
  assert.equal(results.length, 2);
  assert.deepEqual(order, ["s1", "s2"]);
});

test("EffectBuffer flush skips rolled-back scopes", async () => {
  const buffer = new EffectBuffer();
  const scope = buffer.createScope({ scopeId: "scope1" });
  scope.add("event_publish", "s1", async () => {});
  scope.rollback();

  const results = await buffer.flush();
  assert.equal(results.length, 0);
  assert.equal(buffer.getScopeCount(), 1);
});

test("EffectBuffer flush skips uncommitted scopes", async () => {
  const buffer = new EffectBuffer();
  buffer.createScope({ scopeId: "scope1" });

  const results = await buffer.flush();
  assert.equal(results.length, 0);
});

test("EffectBuffer clear removes all scopes", () => {
  const buffer = new EffectBuffer();
  buffer.createScope({ scopeId: "scope1" });
  buffer.createScope({ scopeId: "scope2" });
  buffer.clear();
  assert.equal(buffer.getScopeCount(), 0);
});

test("EffectScope throws on executeEffects when never committed", async () => {
  const scope = new EffectScope({ scopeId: "test" });
  // Never commit or rollback — the code checks !this.committed first and throws
  await assert.rejects(
    () => scope.executeEffects(),
    /effect_scope.not_committed/,
  );
});

test("EffectScope isCommitted and isRolledBack", () => {
  const scope = new EffectScope({ scopeId: "test" });
  assert.equal(scope.isCommitted(), false);
  assert.equal(scope.isRolledBack(), false);

  scope.commit();
  assert.equal(scope.isCommitted(), true);
  assert.equal(scope.isRolledBack(), false);

  const scope2 = new EffectScope({ scopeId: "test2" });
  scope2.rollback();
  assert.equal(scope2.isCommitted(), false);
  assert.equal(scope2.isRolledBack(), true);
});

test("EffectBuffer logger receives all lifecycle events", async () => {
  const logs: Array<{ message: string; context?: Record<string, unknown> }> = [];
  const buffer = new EffectBuffer((msg, ctx) => logs.push({ message: msg, ...(ctx != null ? { context: ctx } : {}) }));

  const scope = buffer.createScope({ scopeId: "logged_scope" });
  scope.add("event_publish", "log_test", async () => {});
  scope.commit();
  await buffer.flush();

  assert.ok(logs.some(l => l.message === "scope_created"));
  assert.ok(logs.some(l => l.message === "effect_added"));
  assert.ok(logs.some(l => l.message === "effect_scope_committed"));
  assert.ok(logs.some(l => l.message === "executing_effects"));
  assert.ok(logs.some(l => l.message === "effect_succeeded"));
});

test("EffectScope executeEffects Promise.race effect throws before timeout fires", async () => {
  // Tests the concurrent path: effect throws BEFORE timeout fires.
  // Promise.race rejects with whichever settles first (the effect error).
  // This exercises the catch block at line 350 handling the effect error,
  // NOT the timeout error code, when the effect throws quickly.
  const scope = new EffectScope({ scopeId: "test", defaultTimeoutMs: 100 });

  scope.addEffect(EffectBuilder.create("event_publish", "fast_fail")
    .withTimeout(50) // timeout is longer than the throw
    .withExecute(async () => {
      throw new Error("effect threw before timeout");
    })
    .build());

  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.failed, 1);
  assert.equal(result.succeeded, 0);
  // Error should be the effect error, NOT a timeout error (effect.timeout:xxx)
  assert.ok(result.results[0]!.error!.message.includes("effect threw before timeout"));
  // Confirm it's NOT the timeout error code format
  assert.ok(!result.results[0]!.error!.message.startsWith("effect.timeout:"), `Expected effect error, got timeout: ${result.results[0]!.error!.message}`);
});

test("EffectScope executeEffects Promise.race timeout fires during slow effect", async () => {
  // Tests when timeout fires while effect is still running (effect eventually throws).
  // Promise.race rejects with the timeout error (fires first).
  const scope = new EffectScope({ scopeId: "test", defaultTimeoutMs: 100 });

  scope.addEffect(EffectBuilder.create("event_publish", "slow_throw")
    .withTimeout(20) // timeout fires before effect completes
    .withExecute(async () => {
      await new Promise((_, reject) => setTimeout(() => reject(new Error("effect threw late")), 200));
    })
    .build());

  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.failed, 1);
  assert.equal(result.succeeded, 0);
  // Error should be the timeout error (fires first)
  assert.ok(result.results[0]!.error!.message.includes("timeout"));
});

test("EffectScope executeEffects multiple effects with mixed success and timeout", async () => {
  // Tests effect execution with one succeeding, one timeout, one throwing
  const scope = new EffectScope({ scopeId: "test", defaultTimeoutMs: 200 });

  scope.addEffect(EffectBuilder.create("event_publish", "succeeds")
    .withExecute(async () => {})
    .build());
  scope.addEffect(EffectBuilder.create("event_publish", "times_out")
    .withTimeout(10)
    .withExecute(async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
    })
    .build());
  scope.addEffect(EffectBuilder.create("event_publish", "throws")
    .withExecute(async () => {
      throw new Error("effect error");
    })
    .build());

  scope.commit();
  const result = await scope.executeEffects();

  // stopOnFailure is false by default, so all effects are attempted
  assert.equal(result.succeeded, 1); // first effect succeeds
  assert.equal(result.failed, 2);   // second and third fail
  assert.equal(result.results[1]!.error!.message.includes("timeout"), true);
  assert.equal(result.results[2]!.error!.message.includes("effect error"), true);
});

test("EffectScope executeEffects with continueOnFailure and mixed errors", async () => {
  // Tests that effects marked continueOnFailure continue even when others fail
  const scope = new EffectScope({ scopeId: "test", defaultTimeoutMs: 200 });

  scope.addEffect(EffectBuilder.create("event_publish", "fails")
    .withExecute(async () => { throw new Error("first fail"); })
    .build());
  scope.addEffect(EffectBuilder.create("event_publish", "continues")
    .continueOnFailure()
    .withExecute(async () => {})
    .build());
  scope.addEffect(EffectBuilder.create("event_publish", "also_fails")
    .withExecute(async () => { throw new Error("third fail"); })
    .build());

  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(result.succeeded, 1); // continues succeeds
  assert.equal(result.failed, 2);   // fails and also_fails fail
  assert.equal(result.allSucceeded, false);
});
