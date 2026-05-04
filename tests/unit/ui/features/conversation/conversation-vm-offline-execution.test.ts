import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/packages/features/conversation/src/hooks/index.ts",
  "utf8",
);

test("offline executePlan no longer simulates local execution", () => {
  assert.ok(source.includes("Local in-memory simulation bypasses the intake pipeline"));
  assert.ok(source.includes("setStatus(\"clarifying\")"));
  assert.ok(source.includes("当前离线状态下无法执行任务，请检查网络连接后重试"));
  assert.ok(source.includes("syncInMemoryState(planReady, false);"));
});
