import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import type { PluginRuntimeMessage } from "../../../../src/domains/registry/plugin-runtime-protocol.js";

// Validator for runtime messages
function isValidMessage(msg: unknown): msg is PluginRuntimeMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (m.type === "ready") return typeof m.pid === "number";
  if (m.type === "response") {
    return typeof m.requestId === "string" && typeof m.ok === "boolean" && typeof m.pid === "number";
  }
  return false;
}

test("PluginRuntimeMessage parses ready message", () => {
  const input: PluginRuntimeMessage = { type: "ready", pid: 12345 };
  assert.equal(input.type, "ready");
  assert.equal(input.pid, 12345);
  assert.ok(isValidMessage(input));
});

test("PluginRuntimeMessage parses response message", () => {
  const input: PluginRuntimeMessage = { type: "response", requestId: "req_1", ok: true, pid: 12345, result: { data: "test" } };
  assert.equal(input.type, "response");
  assert.equal(input.ok, true);
  assert.ok(isValidMessage(input));
});

test("PluginRuntimeMessage parses error response", () => {
  const input: PluginRuntimeMessage = { type: "response", requestId: "req_1", ok: false, pid: 12345, error: { name: "Error", message: "Something went wrong" } };
  assert.equal(input.ok, false);
  assert.equal(input.error?.name, "Error");
  assert.ok(isValidMessage(input));
});

test("isValidMessage rejects invalid type", () => {
  const invalid = { type: "invalid", pid: 12345 };
  assert.ok(!isValidMessage(invalid));
});

test("isValidMessage rejects missing pid", () => {
  const invalid = { type: "ready" };
  assert.ok(!isValidMessage(invalid));
});

test("plugin runtime child routes console output through structured logger with request correlation fields", () => {
  const source = readFileSync("src/domains/registry/plugin-runtime-child.ts", "utf8");
  assert.match(source, /new StructuredLogger\(\{ retentionLimit: 100, service: "plugin-runtime-child" \}\)/);
  assert.match(source, /let currentRequest: PluginRuntimeRequest \| null = null;/);
  assert.match(source, /export function bootstrapPluginRuntimeChild\(\): void/);
  assert.match(source, /if \(process\.argv\[1\] != null && resolve\(process\.argv\[1\]\) === runtimeChildEntryPath\) \{\s*bootstrapPluginRuntimeChild\(\);\s*\}/s);
  assert.match(source, /const requestId = currentRequest\?\.requestId;/);
  assert.match(source, /requestId,\s*traceId: requestId,\s*correlationId: requestId/s);
  assert.match(source, /process\.stderr\.write\(`\$\{JSON\.stringify\(entry\)\}\\n`\)/);
  assert.match(source, /function logProtocolError\(message: string, error: unknown\): void/);
  assert.match(source, /console\.error\("%s: %s", message, error instanceof Error \? error\.message : String\(error\)\)/);
  assert.doesNotMatch(source, /plugin-runtime-child invalid stdio payload: \$\{/);
  assert.doesNotMatch(source, /plugin-runtime-child protocol violation: \$\{/);
});
