import assert from "node:assert/strict";
import test from "node:test";

import { parseIntentTokens, type ParsedIntentToken } from "../../../src/interaction/nl-gateway/intent-parser/index.js";

test("parseIntentTokens detects approval_action for approval keywords", () => {
  const tokens = parseIntentTokens("请审批这个请求");
  assert.equal(tokens[0]?.intentType, "approval_action");
  assert.ok(tokens[0]?.confidence >= 0.9);
});

test("parseIntentTokens detects status_inquiry for status keywords", () => {
  const tokens = parseIntentTokens("查询一下任务状态");
  assert.equal(tokens[0]?.intentType, "status_inquiry");
});

test("parseIntentTokens detects task_modify for delete keywords", () => {
  const tokens = parseIntentTokens("删除这个任务");
  assert.equal(tokens[0]?.intentType, "task_modify");
});

test("parseIntentTokens detects task_create for create keywords", () => {
  const tokens = parseIntentTokens("创建一个新的部署任务");
  assert.equal(tokens[0]?.intentType, "task_create");
});

test("parseIntentTokens defaults to task_query for unknown intent", () => {
  const tokens = parseIntentTokens("hello world");
  assert.equal(tokens[0]?.intentType, "task_query");
  assert.ok(tokens[0]?.confidence < 0.7);
});

test("parseIntentTokens respects case-insensitivity", () => {
  const tokens1 = parseIntentTokens("DELETE the task");
  const tokens2 = parseIntentTokens("delete the task");
  assert.equal(tokens1[0]?.intentType, tokens2[0]?.intentType);
});

test("parseIntentTokens Chinese keywords", () => {
  const tokens = parseIntentTokens("审批流程");
  assert.equal(tokens[0]?.intentType, "approval_action");
});
