import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { runMultiStepOrchestration } from "../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";
import { VcrFixtureStore } from "../../../../src/platform/shared/stability/vcr-replay-fixture.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("multi-step orchestration stream frames can be recorded and replayed through VCR fixtures", async () => {
  const workspace = createTempWorkspace("aa-vcr-replay-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: join(workspace, "multi-step-vcr.db"),
      title: "Multi-step VCR replay run",
      request: "Summarize the task in detail and create a comprehensive summary document.",
    });

    const request = {
      provider: "fixture_provider",
      model: "multi-step-orchestrator",
      messages: [
        { role: "system" as const, content: "Replay the multi-step orchestration fixture." },
        { role: "user" as const, content: "Summarize the task in detail and create a comprehensive summary document." },
      ],
      tools: ["analysis"],
      settings: { reasoningLevel: "medium" },
    };
    const store = new VcrFixtureStore();
    const interaction = store.createInteraction({
      interactionId: "multi-step-stream-replay",
      request,
      responsePayload: {
        finalTaskStatus: result.snapshot.task.status,
        stepCount: result.snapshot.stepOutputs.length,
      },
      streamChunks: result.streamFrames,
      usageSnapshot: { streamedFrameCount: result.streamFrames.length },
    });
    const loaded = new VcrFixtureStore(VcrFixtureStore.loadFixture({ interactions: [interaction] }));
    const replayed = loaded.replay(request);

    assert.equal(replayed.responsePayload.finalTaskStatus, "done");
    assert.equal(replayed.responsePayload.stepCount, 3);
    assert.deepEqual(
      replayed.streamChunks?.map((frame) => frame.sequence),
      result.streamFrames.map((frame) => frame.sequence),
    );
    assert.ok(replayed.streamChunks?.some((frame) => frame.eventType === "message_delta"));
    assert.equal(replayed.streamChunks?.at(-1)?.eventType, "completed");
  } finally {
    cleanupPath(workspace);
  }
});
