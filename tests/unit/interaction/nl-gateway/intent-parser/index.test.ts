/**
 * Unit tests for intent-parser utilities
 */

import assert from "node:assert/strict";
import test from "node:test";
import { parseIntentTokens, type ParsedIntentToken } from "../../../../../src/interaction/nl-gateway/intent-parser/index.js";

// Approval action tests
test("parseIntentTokens detects approval_action with approve keyword", () => {
  const result = parseIntentTokens("请审批这个请求");
  assert.equal(result.length, 1);
  assert.equal(result[0]!.intentType, "approval_action");
  assert.equal(result[0]!.confidence, 0.92);
});

test("parseIntentTokens detects approval_action with Chinese", () => {
  const result = parseIntentTokens("通过这个工单");
  assert.equal(result[0]!.intentType, "approval_action");
});

test("parseIntentTokens detects approval_action with English APPROVE uppercase", () => {
  const result = parseIntentTokens("APPROVE this request");
  assert.equal(result[0]!.intentType, "approval_action");
  assert.equal(result[0]!.confidence, 0.92);
});

test("parseIntentTokens detects approval_action with mixed case Approve", () => {
  const result = parseIntentTokens("Approve This Please");
  assert.equal(result[0]!.intentType, "approval_action");
});

test("parseIntentTokens detects approval_action with Chinese 审批", () => {
  const result = parseIntentTokens("需要你审批一下");
  assert.equal(result[0]!.intentType, "approval_action");
});

// Status inquiry tests
test("parseIntentTokens detects status_inquiry with status keyword", () => {
  const result = parseIntentTokens("查看任务状态");
  assert.equal(result.length, 1);
  assert.equal(result[0]!.intentType, "status_inquiry");
  assert.equal(result[0]!.confidence, 0.84);
});

test("parseIntentTokens detects status_inquiry with summary keyword", () => {
  const result = parseIntentTokens("同步一下情况");
  assert.equal(result[0]!.intentType, "status_inquiry");
});

test("parseIntentTokens detects status_inquiry with Chinese 状态", () => {
  const result = parseIntentTokens("当前状态是什么");
  assert.equal(result[0]!.intentType, "status_inquiry");
});

test("parseIntentTokens detects status_inquiry with STATUS uppercase", () => {
  const result = parseIntentTokens("STATUS of the task");
  assert.equal(result[0]!.intentType, "status_inquiry");
});

test("parseIntentTokens detects status_inquiry with 同步 keyword", () => {
  const result = parseIntentTokens("请同步一下进度");
  assert.equal(result[0]!.intentType, "status_inquiry");
});

// Task modify tests
test("parseIntentTokens detects task_modify with delete keyword", () => {
  const result = parseIntentTokens("删除这个任务");
  assert.equal(result[0]!.intentType, "task_modify");
  assert.equal(result[0]!.confidence, 0.8);
});

test("parseIntentTokens detects task_modify with modify keyword", () => {
  const result = parseIntentTokens("修改一下配置");
  assert.equal(result[0]!.intentType, "task_modify");
});

test("parseIntentTokens detects task_modify with remove keyword", () => {
  const result = parseIntentTokens("remove this item");
  assert.equal(result[0]!.intentType, "task_modify");
});

test("parseIntentTokens detects task_modify with Chinese 删除", () => {
  const result = parseIntentTokens("删除这条记录");
  assert.equal(result[0]!.intentType, "task_modify");
});

test("parseIntentTokens detects task_modify with Chinese 修改", () => {
  const result = parseIntentTokens("修改一下参数");
  assert.equal(result[0]!.intentType, "task_modify");
});

// Task create tests
test("parseIntentTokens detects task_create with create keyword", () => {
  const result = parseIntentTokens("创建一个新任务");
  assert.equal(result[0]!.intentType, "task_create");
  assert.equal(result[0]!.confidence, 0.88);
});

test("parseIntentTokens detects task_create with make keyword", () => {
  const result = parseIntentTokens("make a reservation");
  assert.equal(result[0]!.intentType, "task_create");
});

test("parseIntentTokens detects task_create with Chinese create keyword", () => {
  const result = parseIntentTokens("帮我生成一个任务");
  assert.equal(result[0]!.intentType, "task_create");
});

test("parseIntentTokens detects task_create with Chinese 创建", () => {
  const result = parseIntentTokens("创建一个任务");
  assert.equal(result[0]!.intentType, "task_create");
});

test("parseIntentTokens detects task_create with Chinese 做一个", () => {
  const result = parseIntentTokens("做一个演示");
  assert.equal(result[0]!.intentType, "task_create");
});

test("parseIntentTokens detects task_create for long messages", () => {
  const result = parseIntentTokens("我想要你帮我处理一些日常事务");
  assert.equal(result[0]!.intentType, "task_create");
});

test("parseIntentTokens detects task_create for messages longer than 12 characters", () => {
  // normalized.length > 12 triggers task_create (12 chars returns task_query)
  const result = parseIntentTokens("我想要你帮我处理一些日常事务");
  assert.equal(result[0]!.intentType, "task_create");
});

test("parseIntentTokens returns task_query for exactly 12 character message", () => {
  // normalized.length > 12 is false when length == 12, so it falls through to task_query
  const result = parseIntentTokens("123456789012");
  assert.equal(result[0]!.intentType, "task_query");
});

// Task query tests (default case)
test("parseIntentTokens defaults to task_query for unrecognized short input", () => {
  const result = parseIntentTokens("hi");
  assert.equal(result[0]!.intentType, "task_query");
  assert.equal(result[0]!.confidence, 0.62);
});

test("parseIntentTokens defaults to task_query for empty-like input", () => {
  const result = parseIntentTokens("abc");
  assert.equal(result[0]!.intentType, "task_query");
  assert.equal(result[0]!.confidence, 0.62);
});

test("parseIntentTokens defaults to task_query for unrecognized word", () => {
  const result = parseIntentTokens("hello");
  assert.equal(result[0]!.intentType, "task_query");
});

test("parseIntentTokens defaults to task_query when no keywords match and message is short", () => {
  // "no pattern" is 9 chars - under threshold, no keywords match
  const result = parseIntentTokens("no pattern");
  assert.equal(result[0]!.intentType, "task_query");
  assert.equal(result[0]!.confidence, 0.62);
});

// Case insensitivity tests
test("parseIntentTokens case insensitive for English keywords", () => {
  const upper = parseIntentTokens("APPROVE this");
  const lower = parseIntentTokens("approve this");
  const mixed = parseIntentTokens("Approve This");

  assert.equal(upper[0]!.intentType, "approval_action");
  assert.equal(lower[0]!.intentType, "approval_action");
  assert.equal(mixed[0]!.intentType, "approval_action");
});

test("parseIntentTokens handles Chinese keywords case insensitively", () => {
  const result = parseIntentTokens("审批");
  assert.equal(result[0]!.intentType, "approval_action");
});

// Return type verification
test("parseIntentTokens returns array with single element", () => {
  const result = parseIntentTokens("test");
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 1);
});

test("parseIntentTokens returns ParsedIntentToken with correct shape", () => {
  const result = parseIntentTokens("create a task");
  const token = result[0]!;
  assert.ok("intentType" in token);
  assert.ok("confidence" in token);
  assert.equal(typeof token.intentType, "string");
  assert.equal(typeof token.confidence, "number");
});