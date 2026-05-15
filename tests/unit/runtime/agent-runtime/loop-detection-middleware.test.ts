import test from "node:test";
import assert from "node:assert/strict";
import {
  SequenceLoopDetector,
  createLoopDetectionMiddleware,
  createLoopDetectionMiddlewareFull,
} from "../../../../src/platform/five-plane-execution/execution-engine/loop-detection.js";

test("SequenceLoopDetector records actions and detects loops", () => {
  const detector = new SequenceLoopDetector({ windowSize: 3, repeatThreshold: 2 });

  // Record a sequence
  detector.recordAction("action_a");
  detector.recordAction("action_b");
  detector.recordAction("action_c");

  // Record the same sequence again - should detect loop
  const result1 = detector.recordAction("action_a");
  const result2 = detector.recordAction("action_b");
  const result3 = detector.recordAction("action_c");

  assert.equal(result3.isLoop, true);
  assert.deepEqual(result3.sequence, ["action_a", "action_b", "action_c"]);
  assert.equal(result3.count, 2);
});

test("SequenceLoopDetector getHistory returns action history", () => {
  const detector = new SequenceLoopDetector({ windowSize: 5 });

  detector.recordAction("step_1");
  detector.recordAction("step_2");
  detector.recordAction("step_3");

  const history = detector.getHistory();
  assert.deepEqual(history, ["step_1", "step_2", "step_3"]);
});

test("SequenceLoopDetector reset clears state", () => {
  const detector = new SequenceLoopDetector({ windowSize: 3 });

  detector.recordAction("a");
  detector.recordAction("b");
  detector.recordAction("a");
  detector.recordAction("b");

  assert.equal(detector.getHistory().length, 4);

  detector.reset();

  assert.deepEqual(detector.getHistory(), []);
});

test("createLoopDetectionMiddleware returns middleware and state", () => {
  const result = createLoopDetectionMiddleware({ warnThreshold: 2, escalateThreshold: 5 });

  assert.ok(result.middleware);
  assert.ok(result.state);
  assert.equal(result.middleware.name, "loop_detection");
});

test("createLoopDetectionMiddlewareFull returns beforeAgent and wrapToolCall hooks", () => {
  const result = createLoopDetectionMiddlewareFull({ warnThreshold: 2, escalateThreshold: 5 });

  assert.ok(result.beforeAgent);
  assert.ok(result.wrapToolCall);
  assert.ok(result.state);
  assert.equal(result.beforeAgent.name, "loop_detection_before_agent");
  assert.equal(result.wrapToolCall.name, "loop_detection_wrap_tool_call");
});

test("createLoopDetectionMiddlewareFull beforeAgent hook escalates when pattern is already escalated", async () => {
  const { beforeAgent, state } = createLoopDetectionMiddlewareFull({ warnThreshold: 1, escalateThreshold: 1 });
  const LoopDetectionStateCtor = (await import("../../../../src/platform/five-plane-execution/execution-engine/loop-detection.js")).LoopDetectionState;
  assert.equal(state instanceof LoopDetectionStateCtor, true);
  state.recordToolCall("tool", { x: 1 }); // triggers escalation immediately

  const middlewareResult = await beforeAgent.run(
    {
      runtime: { traceId: "", taskId: "" },
      chainStartedAt: "",
      agentRound: 0,
      stepId: null,
      executionId: null,
      taskId: "",
    },
    { request: "test", history: [] },
  );

  assert.equal(middlewareResult.success, false);
  assert.ok(middlewareResult.error?.code.includes("escalated"));
});

test("createLoopDetectionMiddlewareFull wrapToolCall records tool calls", async () => {
  const { wrapToolCall, state } = createLoopDetectionMiddlewareFull({ warnThreshold: 3, escalateThreshold: 5 });

  await wrapToolCall.run(
    {
      runtime: { traceId: "", taskId: "" },
      chainStartedAt: "",
      agentRound: 0,
      stepId: null,
      executionId: null,
      taskId: "",
    },
    { toolName: "test_tool", args: { x: 1 } },
    async () => "result",
  );

  assert.equal(state.getRepeatCount("test_tool", { x: 1 }), 1);
});

test("createLoopDetectionMiddlewareFull wrapToolCall throws on escalation", async () => {
  const { wrapToolCall, state } = createLoopDetectionMiddlewareFull({ warnThreshold: 1, escalateThreshold: 1 });

  // Force escalation - record enough calls to trigger escalation
  state.recordToolCall("escalate_tool", { x: 1 });
  state.recordToolCall("escalate_tool", { x: 1 }); // count = 2, exceeds escalateThreshold of 1

  await assert.rejects(
    async () =>
      wrapToolCall.run(
        {
          runtime: { traceId: "", taskId: "" },
          chainStartedAt: "",
          agentRound: 0,
          stepId: null,
          executionId: null,
          taskId: "",
        },
        { toolName: "escalate_tool", args: { x: 1 } },
        async () => "result",
      ),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.match(String((error as Error & { code?: string }).code ?? ""), /loop_detection\.escalated/);
      assert.match((error as Error).message, /repeated 3 times/);
      return true;
    },
  );
});
