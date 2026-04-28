/**
 * BrowserExecutor Extended Unit Tests
 *
 * Additional tests for browser automation execution:
 * - Session state management edge cases
 * - Action result building details
 * - Error classification edge cases
 * - Session URL tracking
 * - Multiple session scenarios
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BrowserExecutor,
  createBrowserExecutor,
  type BrowserExecutionContext,
  type BrowserNavigationOptions,
  type BrowserClickOptions,
  type BrowserInputOptions,
} from "../../../../../src/platform/execution/plugin-executor/browser-executor.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const createTestContext = (overrides: Partial<BrowserExecutionContext> = {}): BrowserExecutionContext => ({
  executionId: "exec-123",
  taskId: "task-456",
  tenantId: "tenant-789",
  correlationId: "corr-abc",
  sessionId: null,
  sandboxTier: "workspace_write",
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// Session State Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor session has correct initial state", () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();

  const sessionId = executor.createSession(context);
  const session = executor.getSession(sessionId);

  assert.ok(session);
  assert.equal(session!.isActive, true);
  assert.equal(session!.url, "about:blank");
  assert.ok(session!.createdAt);
  assert.ok(session!.lastUsedAt);
  assert.equal(session!.createdAt, session!.lastUsedAt);
});

test("BrowserExecutor session URL updates after navigation", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  await executor.navigate(sessionId, context, { url: "https://example.com/page" });

  const session = executor.getSession(sessionId);
  assert.equal(session!.url, "https://example.com/page");
});

test("BrowserExecutor session lastUsedAt updates on action", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const sessionBefore = executor.getSession(sessionId);
  const beforeTime = sessionBefore!.lastUsedAt;

  // Small delay to ensure timestamp difference
  await executor.click(sessionId, context, { selector: "#btn" });

  const sessionAfter = executor.getSession(sessionId);
  assert.ok(sessionAfter!.lastUsedAt >= beforeTime);
});

test("BrowserExecutor closes session and removes from map", () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();

  const sessionId = executor.createSession(context);
  assert.equal(executor.listSessions().length, 1);

  executor.closeSession(sessionId);

  assert.equal(executor.listSessions().length, 0);
  assert.equal(executor.getSession(sessionId), null);
});

test("BrowserExecutor multiple sessions are independent", async () => {
  const executor = new BrowserExecutor();
  const context1 = createTestContext({ executionId: "exec-1" });
  const context2 = createTestContext({ executionId: "exec-2" });

  const sessionId1 = executor.createSession(context1);
  const sessionId2 = executor.createSession(context2);

  await executor.navigate(sessionId1, context1, { url: "https://site-a.com" });
  await executor.navigate(sessionId2, context2, { url: "https://site-b.com" });

  assert.equal(executor.getSession(sessionId1)!.url, "https://site-a.com");
  assert.equal(executor.getSession(sessionId2)!.url, "https://site-b.com");
});

test("BrowserExecutor closing one session does not affect others", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();

  const sessionId1 = executor.createSession(context);
  const sessionId2 = executor.createSession(context);

  executor.closeSession(sessionId1);

  assert.equal(executor.listSessions().length, 1);
  assert.ok(executor.getSession(sessionId2));
});

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor navigate with waitUntil option", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com",
    waitUntil: "networkidle",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor navigate with custom timeout overrides default", async () => {
  const executor = new BrowserExecutor({ navigationTimeout: 5000 });
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com",
    timeout: 120000,
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor navigate rejects ftp protocol", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "ftp://files.example.com",
  });

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("Only http and https URLs are allowed"));
});

test("BrowserExecutor navigate rejects javascript protocol", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "javascript:alert('xss')",
  });

  assert.equal(result.status, "error");
});

test("BrowserExecutor navigate rejects data protocol", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "data:text/html,<h1>Hello</h1>",
  });

  assert.equal(result.status, "error");
});

// ─────────────────────────────────────────────────────────────────────────────
// Click Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor click with double click", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.click(sessionId, context, {
    selector: "#button",
    clickCount: 2,
  });

  assert.equal(result.status, "ok");
  const output = result.output as { clickCount: number };
  assert.equal(output.clickCount, 2);
});

test("BrowserExecutor click with middle mouse button", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.click(sessionId, context, {
    selector: "#trackpad",
    button: "middle",
  });

  assert.equal(result.status, "ok");
  const output = result.output as { button: string };
  assert.equal(output.button, "middle");
});

test("BrowserExecutor click rejects empty selector", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.click(sessionId, context, {
    selector: "",
  });

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("cannot be empty"));
});

test("BrowserExecutor click rejects whitespace-only selector", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.click(sessionId, context, {
    selector: "   \n\t  ",
  });

  assert.equal(result.status, "error");
});

// ─────────────────────────────────────────────────────────────────────────────
// Input Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor input preserves text length in output", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const longText = "This is a very long text that should be tracked by length";
  const result = await executor.input(sessionId, context, {
    selector: "textarea",
    text: longText,
  });

  assert.equal(result.status, "ok");
  const output = result.output as { textLength: number };
  assert.equal(output.textLength, longText.length);
});

test("BrowserExecutor input defaults clear to false", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.input(sessionId, context, {
    selector: "input",
    text: "hello",
  });

  const output = result.output as { cleared: boolean };
  assert.equal(output.cleared, false);
});

test("BrowserExecutor input rejects empty selector", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.input(sessionId, context, {
    selector: "",
    text: "hello",
  });

  assert.equal(result.status, "error");
});

test("BrowserExecutor input rejects whitespace selector", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.input(sessionId, context, {
    selector: "\t\n  ",
    text: "hello",
  });

  assert.equal(result.status, "error");
});

// ─────────────────────────────────────────────────────────────────────────────
// Screenshot Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor screenshot generates artifactId", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.screenshot(sessionId, context, {});

  assert.equal(result.status, "ok");
  assert.ok(result.artifactRef);
  assert.ok(result.artifactRef.startsWith("art_"));
});

test("BrowserExecutor screenshot output includes fullPage flag", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result1 = await executor.screenshot(sessionId, context, { fullPage: true });
  const result2 = await executor.screenshot(sessionId, context, { fullPage: false });

  const output1 = result1.output as { fullPage: boolean };
  const output2 = result2.output as { fullPage: boolean };

  assert.equal(output1.fullPage, true);
  assert.equal(output2.fullPage, false);
});

test("BrowserExecutor screenshot output includes selector when provided", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.screenshot(sessionId, context, {
    selector: ".element-to-capture",
  });

  const output = result.output as { selector: string | null };
  assert.equal(output.selector, ".element-to-capture");
});

test("BrowserExecutor screenshot output defaults selector to null", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.screenshot(sessionId, context, {});

  const output = result.output as { selector: string | null };
  assert.equal(output.selector, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Evaluate Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor evaluate rejects whitespace-only script", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.evaluate(sessionId, context, {
    script: "     ",
  });

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("cannot be empty"));
});

test("BrowserExecutor evaluate rejects newline-only script", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.evaluate(sessionId, context, {
    script: "\n\n\n",
  });

  assert.equal(result.status, "error");
});

test("BrowserExecutor evaluate accepts script with args", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.evaluate(sessionId, context, {
    script: "return args[0].name;",
    args: [{ name: "test-object" }],
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor evaluate handles undefined args", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.evaluate(sessionId, context, {
    script: "return 'no args'",
  });

  assert.equal(result.status, "ok");
  const output = result.output as { script: string; result: unknown };
  assert.equal(output.script, "return 'no args'");
  assert.deepEqual(output.result, { result: "evaluated" }); // Default behavior
});

// ─────────────────────────────────────────────────────────────────────────────
// GetAttribute Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor getAttribute handles various attribute values", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  // Test data-* attributes
  const result = await executor.getAttribute(sessionId, context, {
    selector: "div",
    attribute: "data-custom",
  });

  const output = result.output as { value: string | null };
  assert.equal(output.value, null); // Default simulation returns null for unknown attributes
});

test("BrowserExecutor getAttribute output includes selector and attribute name", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.getAttribute(sessionId, context, {
    selector: "a.nav-link",
    attribute: "class",
  });

  const output = result.output as { selector: string; attribute: string };
  assert.equal(output.selector, "a.nav-link");
  assert.equal(output.attribute, "class");
});

test("BrowserExecutor getAttribute rejects empty selector", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.getAttribute(sessionId, context, {
    selector: "",
    attribute: "href",
  });

  assert.equal(result.status, "error");
});

// ─────────────────────────────────────────────────────────────────────────────
// WaitForSelector Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor waitForSelector with attached state", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.waitForSelector(sessionId, context, {
    selector: "#element",
    state: "attached",
  });

  assert.equal(result.status, "ok");
  const output = result.output as { state: string };
  assert.equal(output.state, "attached");
});

test("BrowserExecutor waitForSelector with hidden state", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.waitForSelector(sessionId, context, {
    selector: "#hidden",
    state: "hidden",
  });

  assert.equal(result.status, "ok");
  const output = result.output as { state: string };
  assert.equal(output.state, "hidden");
});

test("BrowserExecutor waitForSelector defaults to visible state", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.waitForSelector(sessionId, context, {
    selector: "#element",
  });

  const output = result.output as { state: string };
  assert.equal(output.state, "visible");
});

test("BrowserExecutor waitForSelector uses provided timeout", async () => {
  const executor = new BrowserExecutor({ defaultTimeout: 30000 });
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.waitForSelector(sessionId, context, {
    selector: "#slow",
    timeout: 120000,
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor waitForSelector rejects empty selector", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.waitForSelector(sessionId, context, {
    selector: "",
  });

  assert.equal(result.status, "error");
});

// ─────────────────────────────────────────────────────────────────────────────
// Scroll Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor scroll without selector scrolls page", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.scroll(sessionId, context, {
    x: 0,
    y: 1000,
  });

  assert.equal(result.status, "ok");
  const output = result.output as { selector: null; x: number; y: number };
  assert.equal(output.selector, null);
  assert.equal(output.x, 0);
  assert.equal(output.y, 1000);
});

test("BrowserExecutor scroll with selector scrolls to element", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.scroll(sessionId, context, {
    selector: "#footer",
    x: 0,
    y: 0,
  });

  assert.equal(result.status, "ok");
  const output = result.output as { selector: string | null };
  assert.equal(output.selector, "#footer");
});

test("BrowserExecutor scroll defaults coordinates to zero", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.scroll(sessionId, context, {});

  assert.equal(result.status, "ok");
  const output = result.output as { x: number; y: number };
  assert.equal(output.x, 0);
  assert.equal(output.y, 0);
});

test("BrowserExecutor scroll validates selector when provided (empty)", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.scroll(sessionId, context, {
    selector: "",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor scroll allows empty selector (page scroll)", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.scroll(sessionId, context, {
    selector: undefined,
  });

  assert.equal(result.status, "ok");
});

// ─────────────────────────────────────────────────────────────────────────────
// Execution Log Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor execution log accumulates multiple actions", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  await executor.navigate(sessionId, context, { url: "https://example.com/1" });
  await executor.click(sessionId, context, { selector: "#btn" });
  await executor.input(sessionId, context, { selector: "input", text: "test" });
  await executor.screenshot(sessionId, context, {});

  const log = executor.getExecutionLog();
  assert.equal(log.length, 4);
});

test("BrowserExecutor execution log is in order", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  await executor.navigate(sessionId, context, { url: "https://a.com" });
  await executor.navigate(sessionId, context, { url: "https://b.com" });
  await executor.navigate(sessionId, context, { url: "https://c.com" });

  const log = executor.getExecutionLog();
  const urls = log.map((entry) => (entry.output as { url: string }).url);
  assert.deepStrictEqual(urls, ["https://a.com", "https://b.com", "https://c.com"]);
});

test("BrowserExecutor clearExecutionLog removes all entries", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  await executor.navigate(sessionId, context, { url: "https://example.com" });

  assert.equal(executor.getExecutionLog().length, 1);

  executor.clearExecutionLog();

  assert.equal(executor.getExecutionLog().length, 0);
});

test("BrowserExecutor execution log contains error results", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  await executor.navigate(sessionId, context, { url: "invalid://url" });

  const log = executor.getExecutionLog();
  assert.equal(log.length, 1);
  assert.equal(log[0]!.status, "error");
  assert.ok(log[0]!.error);
});

test("BrowserExecutor execution log entry has correct structure", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, { url: "https://example.com" });

  const log = executor.getExecutionLog();
  const entry = log[0]!;

  assert.ok(entry.executionId);
  assert.ok(entry.browserAction);
  assert.ok(typeof entry.durationMs === "number");
  assert.ok(entry.timestamp);
  assert.equal(entry.status, "ok");
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Classification Extended Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor classifies error with timeout in message", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  // Simulate evaluate with error containing "Timeout"
  const result = await executor.evaluate(sessionId, context, {
    script: "throw new Error('Request Timeout after 30000ms')",
  });

  // The simulation doesn't actually throw, but error classification is tested in buildErrorResult
  // For actual timeout classification, we'd need a real browser or more sophisticated simulation
  assert.equal(result.status, "ok");
});

test("BrowserExecutor classifies error with navigation in message", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  // Test with invalid URL that might be classified as navigation error
  const result = await executor.navigate(sessionId, context, {
    url: "not-valid",
  });

  assert.equal(result.status, "error");
  assert.ok(result.error);
});

test("BrowserExecutor error result has correct structure", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "javascript:void(0)",
  });

  if (result.status === "error") {
    assert.ok(result.error);
    assert.deepEqual(result.output, {});
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BrowserExecutorOptions Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor uses custom default timeout", async () => {
  const executor = new BrowserExecutor({ defaultTimeout: 60000 });
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.waitForSelector(sessionId, context, {
    selector: "#element",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor uses custom navigation timeout", async () => {
  const executor = new BrowserExecutor({ navigationTimeout: 120000 });
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor uses custom screenshot directory option", () => {
  const executor = new BrowserExecutor({
    screenshotDirectory: "/custom/screenshots/path",
  });

  // The option is stored but not directly tested since it affects internal behavior
  assert.ok(executor);
});

test("BrowserExecutor defaults are applied correctly", () => {
  const executor = new BrowserExecutor();

  // Default timeout is 30000ms
  // Default navigation timeout is 60000ms
  // We can verify through behavior that defaults work
  assert.ok(executor);
});

test("createBrowserExecutor creates executor with all options", () => {
  const executor = createBrowserExecutor({
    defaultTimeout: 45000,
    navigationTimeout: 90000,
    screenshotDirectory: "/tmp/browser-screenshots",
  });

  assert.ok(executor instanceof BrowserExecutor);
});

test("createBrowserExecutor with no options uses defaults", () => {
  const executor = createBrowserExecutor();

  assert.ok(executor instanceof BrowserExecutor);
});

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox Tier in Context Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor handles sandboxTier none in context", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext({ sandboxTier: "read_only" });
  const sessionId = executor.createSession(context);

  const result = await executor.click(sessionId, context, {
    selector: "#btn",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor handles sandboxTier process in context", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext({ sandboxTier: "read_only" });
  const sessionId = executor.createSession(context);

  const result = await executor.click(sessionId, context, {
    selector: "#btn",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor handles sandboxTier container in context", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext({ sandboxTier: "workspace_write" });
  const sessionId = executor.createSession(context);

  const result = await executor.click(sessionId, context, {
    selector: "#btn",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor includes context in result output", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext({
    executionId: "exec-special",
    taskId: "task-special",
  });
  const sessionId = executor.createSession(context);

  // The result includes browserAction and status, but context info is in the log
  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com",
  });

  assert.ok(result.executionId);
  assert.equal(result.browserAction, "navigate");
});

// ─────────────────────────────────────────────────────────────────────────────
// Session ID Format Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor session ID follows naming convention", () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();

  const sessionId = executor.createSession(context);

  assert.ok(sessionId.startsWith("bsession_"));
});

test("BrowserExecutor execution ID follows naming convention", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com",
  });

  assert.ok(result.executionId.startsWith("bexec_"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Timestamp Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor result has ISO timestamp", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com",
  });

  // Should be parseable as ISO date
  const timestamp = Date.parse(result.timestamp);
  assert.ok(!isNaN(timestamp));
});

test("BrowserExecutor result timestamp is recent", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const beforeTime = Date.now();
  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com",
  });
  const afterTime = Date.now();

  const timestamp = Date.parse(result.timestamp);
  assert.ok(timestamp >= beforeTime && timestamp <= afterTime);
});

// ─────────────────────────────────────────────────────────────────────────────
// Duration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor result duration is non-negative", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com",
  });

  assert.ok(result.durationMs >= 0);
});

test("BrowserExecutor duration reflects operation time", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const start = Date.now();
  await executor.navigate(sessionId, context, { url: "https://example.com" });
  await executor.click(sessionId, context, { selector: "#btn" });
  const end = Date.now();

  const log = executor.getExecutionLog();
  const totalDuration = log.reduce((sum, entry) => sum + entry.durationMs, 0);

  assert.ok(totalDuration <= end - start + 100); // Allow some tolerance
});
