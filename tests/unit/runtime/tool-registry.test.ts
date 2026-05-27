import assert from "node:assert/strict";
import test from "node:test";
import { execSync } from "node:child_process";

import { resetModelCallProvider } from "../../../src/platform/five-plane-execution/execution-engine/model-call-provider.js";

function isInsideGitRepo(): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
import {
  executeMultiStepToolCallForTests,
  resetMultiStepToolRegistryForTests,
} from "../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";

test("multi-step tool registry executes repo-map searches [tool-registry]", async () => {
  resetMultiStepToolRegistryForTests();
  const raw = await executeMultiStepToolCallForTests("repo-map", JSON.stringify({
    query: "multi-step orchestration",
    limit: 5,
  }));
  const result = JSON.parse(raw) as {
    success: boolean;
    files: Array<{ relativePath: string }>;
    symbols?: Array<{ name: string }>;
  };

  assert.equal(result.success, true);
  assert.ok(result.files.length > 0);
  assert.ok(result.files.some((file) => file.relativePath.includes("orchestration")));
  assert.ok((result.symbols ?? []).length > 0);
});

test("multi-step tool registry executes sandboxed git commands [tool-registry]", async () => {
  resetMultiStepToolRegistryForTests();
  const raw = await executeMultiStepToolCallForTests("git", JSON.stringify({
    args: ["rev-parse", "--is-inside-work-tree"],
  }));
  const result = JSON.parse(raw) as {
    success: boolean;
    output?: { sanitizedText?: string };
    error?: { message?: string };
  };

  if (isInsideGitRepo()) {
    assert.equal(result.success, true);
    assert.match(result.output?.sanitizedText ?? "", /true/);
    return;
  }

  assert.equal(result.success, false);
  assert.match(result.error?.message ?? "", /git/i);
});

test("multi-step tool registry can batch parallel read-only tools [tool-registry]", async () => {
  resetMultiStepToolRegistryForTests();
  const raw = await executeMultiStepToolCallForTests("batch-tool", JSON.stringify({
    parallel: true,
    toolCalls: [
      { toolName: "question", arguments: { question: "Need human input?" } },
      { toolName: "repo-map", arguments: { query: "structured logger", limit: 2 } },
    ],
  }));
  const result = JSON.parse(raw) as {
    success: boolean;
    executionMode: string;
    results: Array<{ toolName: string }>;
  };

  assert.equal(result.success, true);
  assert.equal(result.executionMode, "parallel");
  assert.deepEqual(result.results.map((item) => item.toolName), ["question", "repo-map"]);
});

test("multi-step tool registry can spawn a delegated child loop without a configured model provider [tool-registry]", async () => {
  resetModelCallProvider();
  resetMultiStepToolRegistryForTests();
  const raw = await executeMultiStepToolCallForTests("spawn-agent", JSON.stringify({
    request: "Review the summary and return a concise delegated result.",
    roleId: "delegate",
    stepId: "delegated_review",
  }));
  const result = JSON.parse(raw) as {
    success: boolean;
    status: string;
    summary: string;
  };

  assert.equal(result.success, true);
  assert.equal(result.status, "succeeded");
  assert.match(result.summary, /delegated_review|completed/i);
});

test("multi-step tool registry can wait on a spawned child agent result [tool-registry]", async () => {
  resetModelCallProvider();
  resetMultiStepToolRegistryForTests();
  const spawnRaw = await executeMultiStepToolCallForTests("spawn-agent", JSON.stringify({
    request: "Summarize the delegated task.",
    roleId: "delegate",
    stepId: "delegated_wait",
  }));
  const spawned = JSON.parse(spawnRaw) as {
    success: boolean;
    agentId: string;
    status: string;
  };

  assert.equal(spawned.success, true);
  assert.equal(typeof spawned.agentId, "string");

  const waitRaw = await executeMultiStepToolCallForTests("wait-agent", JSON.stringify({
    agentId: spawned.agentId,
  }));
  const waited = JSON.parse(waitRaw) as {
    success: boolean;
    agentId: string;
    status: string;
    summary: string | null;
  };

  assert.equal(waited.success, true);
  assert.equal(waited.agentId, spawned.agentId);
  assert.equal(waited.status, "succeeded");
  assert.match(waited.summary ?? "", /delegated_wait|completed/i);
});

test("multi-step tool registry can send follow-up messages to a spawned child agent [tool-registry]", async () => {
  resetModelCallProvider();
  resetMultiStepToolRegistryForTests();
  const spawnRaw = await executeMultiStepToolCallForTests("spawn-agent", JSON.stringify({
    request: "Prepare a delegated response.",
    roleId: "delegate",
    stepId: "delegated_follow_up",
  }));
  const spawned = JSON.parse(spawnRaw) as { agentId: string };

  const followUpRaw = await executeMultiStepToolCallForTests("send-message", JSON.stringify({
    agentId: spawned.agentId,
    message: "Include the follow-up note in the delegated response.",
  }));
  const followUp = JSON.parse(followUpRaw) as {
    success: boolean;
    agentId: string;
    messageCount: number;
    result: string | null;
  };

  assert.equal(followUp.success, true);
  assert.equal(followUp.agentId, spawned.agentId);
  assert.equal(followUp.messageCount, 2);
  assert.match(followUp.result ?? "", /follow-up note/i);
});
