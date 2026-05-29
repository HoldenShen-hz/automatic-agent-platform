import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveRepoPath } from "../../../../helpers/repo-root.js";

const source = readFileSync(
  resolveRepoPath("ui/packages/features/conversation/src/hooks/index.ts"),
  "utf8",
);

test("offline executePlan no longer simulates local execution", () => {
  assert.ok(source.includes("translateMessage(\"ui.conversation.execute.requiresConnection\")"));
  assert.ok(source.includes("requestClarification(translateMessage(\"ui.conversation.execute.requiresConnection\"))"));
  assert.ok(!source.includes("syncInMemoryState(planReady, false);"));
});
