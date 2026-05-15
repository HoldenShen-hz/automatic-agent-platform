import assert from "node:assert/strict";
import test from "node:test";

import { LoopDetectionState } from "../../../src/platform/five-plane-execution/execution-engine/loop-detection.js";
import { EffectBuffer, EffectScope } from "../../../src/platform/five-plane-execution/execution-engine/effect-buffer.js";

test("LoopDetectionState and EffectBuffer integration - loop detection triggers effect", async () => {
  const loopState = new LoopDetectionState({ warnThreshold: 1, escalateThreshold: 2 });
  const effectBuffer = new EffectBuffer();

  let warningEffectExecuted = false;
  let escalationEffectExecuted = false;

  // Record first tool call - triggers warning
  const warnResult = loopState.recordToolCall("problematic_tool", { data: "test" });

  if (warnResult.action === "warn") {
    const scope = effectBuffer.createScope({ scopeId: "loop_warning_scope" });
    scope.add("event_publish", "Loop warning detected", async () => { warningEffectExecuted = true; });
    scope.commit();
  }

  // Record second tool call - triggers escalation
  const escalateResult = loopState.recordToolCall("problematic_tool", { data: "test" });

  if (escalateResult.action === "escalate") {
    const scope = effectBuffer.createScope({ scopeId: "loop_escalation_scope" });
    scope.add("event_publish", "Loop escalation detected", async () => { escalationEffectExecuted = true; });
    scope.commit();
  }

  // Execute effects
  await effectBuffer.flush();

  assert.equal(warningEffectExecuted, true, "Warning effect should execute");
  assert.equal(escalationEffectExecuted, true, "Escalation effect should execute");
  assert.equal(loopState.getRepeatCount("problematic_tool", { data: "test" }), 2);
});

test("EffectScope with multiple effects and LoopDetectionState coordination", async () => {
  const loopState = new LoopDetectionState({ warnThreshold: 2, escalateThreshold: 4 });
  const scope = new EffectScope({ scopeId: "coordinated_scope", stopOnFailure: true });

  // Simulate tool calls that build up to warning threshold
  for (let i = 0; i < 2; i++) {
    loopState.recordToolCall("file_reader", { path: "/data/file.txt" });
  }

  // Add effects that track loop status
  let effects = 0;
  scope.add("event_publish", "Track effect 1", async () => {
    const count = loopState.getRepeatCount("file_reader", { path: "/data/file.txt" });
    effects++;
  });
  scope.add("event_publish", "Track effect 2", async () => {
    const wouldEscalate = loopState.wouldEscalate("file_reader", { path: "/data/file.txt" });
    effects++;
  });

  scope.commit();
  const result = await scope.executeEffects();

  assert.equal(effects, 2, "Both effects should execute");
  assert.equal(result.succeeded, 2);
});

test("SequenceLoopDetector with EffectBuffer for sequence tracking", async () => {
  const { SequenceLoopDetector } = await import("../../../src/platform/five-plane-execution/execution-engine/loop-detection.js");

  const detector = new SequenceLoopDetector({ windowSize: 3, repeatThreshold: 2 });
  const effectBuffer = new EffectBuffer();

  // Record some actions
  detector.recordAction("step_1");
  detector.recordAction("step_2");
  detector.recordAction("step_3");

  // Record sequence that would loop
  detector.recordAction("step_1");
  detector.recordAction("step_2");
  detector.recordAction("step_3");

  // Check if loop detected
  const patterns = detector.getHistory();
  assert.ok(patterns.length >= 3, "Should have recorded actions");

  // Create scope to track loop state
  const scope = effectBuffer.createScope({ scopeId: "sequence_tracking" });
  scope.add("metric_record", "Sequence loop check", async () => {
    const history = detector.getHistory();
    if (history.length > 0) {
      detector.reset(); // Clear after check
    }
  });
  scope.commit();

  const results = await effectBuffer.flush();
  assert.equal(results[0]!.succeeded, 1);
});

test("Multiple scopes with different loop patterns", () => {
  const loopState = new LoopDetectionState();
  const effectBuffer = new EffectBuffer();

  // Tool A pattern
  loopState.recordToolCall("tool_a", { id: 1 });
  loopState.recordToolCall("tool_a", { id: 1 });

  // Tool B pattern
  loopState.recordToolCall("tool_b", { id: 2 });

  // Create scope for each pattern
  const scopeA = effectBuffer.createScope({ scopeId: "pattern_a" });
  scopeA.add("event_publish", "Tool A warning", async () => {});
  scopeA.commit();

  const scopeB = effectBuffer.createScope({ scopeId: "pattern_b" });
  scopeB.add("event_publish", "Tool B warning", async () => {});
  scopeB.commit();

  assert.equal(effectBuffer.getScopeCount(), 2);
  assert.equal(loopState.getRepeatCount("tool_a", { id: 1 }), 2);
  assert.equal(loopState.getRepeatCount("tool_b", { id: 2 }), 1);
});

test("EffectBuffer flush handles mixed committed/rolled-back scopes", async () => {
  const effectBuffer = new EffectBuffer();

  // Committed scope
  const scope1 = effectBuffer.createScope({ scopeId: "committed_1" });
  scope1.add("event_publish", "Committed effect", async () => {});
  scope1.commit();

  // Rolled back scope - must commit before rollback
  const scope2 = effectBuffer.createScope({ scopeId: "rolled_back" });
  scope2.add("event_publish", "Rolled back effect", async () => {});
  scope2.commit();
  scope2.rollback();

  // Uncommitted scope
  const scope3 = effectBuffer.createScope({ scopeId: "uncommitted" });
  scope3.add("event_publish", "Never execute", async () => {});

  // Another committed scope
  const scope4 = effectBuffer.createScope({ scopeId: "committed_2" });
  scope4.add("event_publish", "Committed effect 2", async () => {});
  scope4.commit();

  const results = await effectBuffer.flush();

  // Only committed scopes should execute (not rolled_back)
  assert.equal(results.length, 2);
  assert.ok(results.some(r => r.scopeId === "committed_1"));
  assert.ok(results.some(r => r.scopeId === "committed_2"));
});

test("Loop detection state isolation between scopes", () => {
  const stateA = new LoopDetectionState({ warnThreshold: 2, escalateThreshold: 3 });
  const stateB = new LoopDetectionState({ warnThreshold: 1, escalateThreshold: 2 });

  // Record in state A (2 times, threshold 3)
  stateA.recordToolCall("shared_tool", { path: "/a" });
  stateA.recordToolCall("shared_tool", { path: "/a" });

  // Record in state B (1 time, threshold 2)
  stateB.recordToolCall("shared_tool", { path: "/a" });

  // They should be independent
  assert.equal(stateA.getRepeatCount("shared_tool", { path: "/a" }), 2);
  assert.equal(stateB.getRepeatCount("shared_tool", { path: "/a" }), 1);

  // State A with threshold 3, 2 calls: wouldEscalate is false (need 3)
  assert.equal(stateA.wouldEscalate("shared_tool", { path: "/a" }), false);

  // State B with threshold 2, 1 call: wouldEscalate is false (need 2)
  assert.equal(stateB.wouldEscalate("shared_tool", { path: "/a" }), false);

  // Add one more call to state B - now it should escalate
  stateB.recordToolCall("shared_tool", { path: "/a" });
  assert.equal(stateB.wouldEscalate("shared_tool", { path: "/a" }), true);
});