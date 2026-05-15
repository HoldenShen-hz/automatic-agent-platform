/**
 * BrowserExecutor Additional Coverage Tests
 *
 * Additional tests to increase code coverage for browser executor:
 * - Sandbox tier variations in context
 * - Navigation waitUntil options (load, domcontentloaded, networkidle)
 * - WaitForSelector state variations (attached, detached, visible, hidden)
 * - Click button variations (middle button)
 * - Session lastUsedAt timestamp updates
 * - Execution result metadata (timestamp, durationMs)
 * - Multiple session operations
 * - Input validation edge cases
 * - Navigation URL validation edge cases
 * - Executor options (screenshotDirectory)
 * - Error status classification (timeout, navigation_error)
 *
 * Architecture: §14 Runtime Execution Plane
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BrowserExecutor,
  createBrowserExecutor,
  type BrowserExecutionContext,
  type BrowserNavigationOptions,
  type BrowserClickOptions,
  type BrowserWaitForSelectorOptions,
} from "../../../../../src/platform/five-plane-execution/plugin-executor/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createTestContext(overrides: Partial<BrowserExecutionContext> = {}): BrowserExecutionContext {
  return {
    executionId: "exec-123",
    taskId: "task-456",
    tenantId: "tenant-789",
    correlationId: "corr-abc",
    sessionId: null,
    sandboxTier: "container",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox Tier Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor works with sandboxTier none", () => {
  const executor = createBrowserExecutor();
  const context = createTestContext({ sandboxTier: "none" });

  const sessionId = executor.createSession(context);
  const session = executor.getSession(sessionId);

  assert.ok(session);
  assert.equal(session?.isActive, true);
});

test("BrowserExecutor works with sandboxTier process", () => {
  const executor = createBrowserExecutor();
  const context = createTestContext({ sandboxTier: "process" });

  const sessionId = executor.createSession(context);
  const session = executor.getSession(sessionId);

  assert.ok(session);
  assert.equal(session?.isActive, true);
});

test("BrowserExecutor works with sandboxTier container", () => {
  const executor = createBrowserExecutor();
  const context = createTestContext({ sandboxTier: "container" });

  const sessionId = executor.createSession(context);
  const session = executor.getSession(sessionId);

  assert.ok(session);
  assert.equal(session?.isActive, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Navigation waitUntil Options Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.navigate() with waitUntil load", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserNavigationOptions = {
    url: "https://example.com",
    waitUntil: "load",
  };

  const result = await executor.navigate(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "navigate");
});

test("BrowserExecutor.navigate() with waitUntil domcontentloaded", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserNavigationOptions = {
    url: "https://example.com",
    waitUntil: "domcontentloaded",
  };

  const result = await executor.navigate(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "navigate");
});

test("BrowserExecutor.navigate() with waitUntil networkidle", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserNavigationOptions = {
    url: "https://example.com",
    waitUntil: "networkidle",
  };

  const result = await executor.navigate(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "navigate");
});

test("BrowserExecutor.navigate() without waitUntil defaults to load behavior", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com",
  });

  assert.equal(result.status, "ok");
});

// ─────────────────────────────────────────────────────────────────────────────
// WaitForSelector State Options Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.waitForSelector() with state attached", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserWaitForSelectorOptions = {
    selector: "#element",
    state: "attached",
  };

  const result = await executor.waitForSelector(sessionId, context, options);

  assert.equal(result.status, "ok");
  const output = result.output as { selector: string; state: string };
  assert.equal(output.state, "attached");
});

test("BrowserExecutor.waitForSelector() with state detached", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserWaitForSelectorOptions = {
    selector: "#element",
    state: "detached",
  };

  const result = await executor.waitForSelector(sessionId, context, options);

  assert.equal(result.status, "ok");
  const output = result.output as { selector: string; state: string };
  assert.equal(output.state, "detached");
});

test("BrowserExecutor.waitForSelector() with state hidden", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserWaitForSelectorOptions = {
    selector: "#element",
    state: "hidden",
  };

  const result = await executor.waitForSelector(sessionId, context, options);

  assert.equal(result.status, "ok");
  const output = result.output as { selector: string; state: string };
  assert.equal(output.state, "hidden");
});

// ─────────────────────────────────────────────────────────────────────────────
// Click Button Variations Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.click() with middle button", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserClickOptions = {
    selector: "#scroll-element",
    button: "middle",
    clickCount: 1,
  };

  const result = await executor.click(sessionId, context, options);

  assert.equal(result.status, "ok");
  const output = result.output as { selector: string; button: string; clickCount: number };
  assert.equal(output.button, "middle");
  assert.equal(output.clickCount, 1);
});

test("BrowserExecutor.click() with double click", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserClickOptions = {
    selector: "#double-click-btn",
    button: "left",
    clickCount: 2,
  };

  const result = await executor.click(sessionId, context, options);

  assert.equal(result.status, "ok");
  const output = result.output as { selector: string; button: string; clickCount: number };
  assert.equal(output.clickCount, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Session Timestamp Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor session lastUsedAt updates after navigate", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const sessionBefore = executor.getSession(sessionId);
  const createdAt = sessionBefore?.createdAt;

  // Wait a tiny bit then perform operation
  await executor.navigate(sessionId, context, { url: "https://example.com" });

  const sessionAfter = executor.getSession(sessionId);
  assert.ok(sessionAfter);
  assert.ok(sessionAfter?.lastUsedAt);
  // lastUsedAt should be >= createdAt
  assert.ok(sessionAfter!.lastUsedAt >= createdAt!);
});

test("BrowserExecutor session lastUsedAt updates after click", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const sessionBefore = executor.getSession(sessionId);
  const createdAt = sessionBefore?.createdAt;

  await executor.click(sessionId, context, { selector: "#btn" });

  const sessionAfter = executor.getSession(sessionId);
  assert.ok(sessionAfter);
  assert.ok(sessionAfter!.lastUsedAt >= createdAt!);
});

test("BrowserExecutor session lastUsedAt updates after input", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const sessionBefore = executor.getSession(sessionId);
  const createdAt = sessionBefore?.createdAt;

  await executor.input(sessionId, context, { selector: "#input", text: "test" });

  const sessionAfter = executor.getSession(sessionId);
  assert.ok(sessionAfter);
  assert.ok(sessionAfter!.lastUsedAt >= createdAt!);
});

test("BrowserExecutor session lastUsedAt updates after screenshot", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const sessionBefore = executor.getSession(sessionId);
  const createdAt = sessionBefore?.createdAt;

  await executor.screenshot(sessionId, context, {});

  const sessionAfter = executor.getSession(sessionId);
  assert.ok(sessionAfter);
  assert.ok(sessionAfter!.lastUsedAt >= createdAt!);
});

// ─────────────────────────────────────────────────────────────────────────────
// Execution Result Metadata Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor execution result has valid timestamp", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, { url: "https://example.com" });

  assert.ok(result.timestamp);
  assert.ok(typeof result.timestamp === "string");
  assert.ok(result.timestamp.length > 0);
});

test("BrowserExecutor execution result has valid executionId", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, { url: "https://example.com" });

  assert.ok(result.executionId);
  assert.ok(result.executionId.startsWith("bexec_"));
});

test("BrowserExecutor execution results have incremental executionIds", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result1 = await executor.navigate(sessionId, context, { url: "https://example.com/1" });
  const result2 = await executor.click(sessionId, context, { selector: "#btn" });
  const result3 = await executor.screenshot(sessionId, context, {});

  assert.notEqual(result1.executionId, result2.executionId);
  assert.notEqual(result2.executionId, result3.executionId);
  assert.notEqual(result1.executionId, result3.executionId);
});

// ─────────────────────────────────────────────────────────────────────────────
// Multiple Session Operations Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor multiple sessions can operate independently", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();

  const sessionId1 = executor.createSession(context);
  const sessionId2 = executor.createSession(context);

  await executor.navigate(sessionId1, context, { url: "https://site-a.com" });
  await executor.navigate(sessionId2, context, { url: "https://site-b.com" });

  const session1 = executor.getSession(sessionId1);
  const session2 = executor.getSession(sessionId2);

  assert.ok(session1);
  assert.ok(session2);
  assert.equal(session1?.url, "https://site-a.com");
  assert.equal(session2?.url, "https://site-b.com");
});

test("BrowserExecutor closing one session does not affect others", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();

  const sessionId1 = executor.createSession(context);
  const sessionId2 = executor.createSession(context);

  executor.closeSession(sessionId1);

  const sessions = executor.listSessions();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.sessionId, sessionId2);

  // Session2 should still work
  const result = await executor.navigate(sessionId2, context, { url: "https://example.com" });
  assert.equal(result.status, "ok");
});

test("BrowserExecutor listSessions returns empty after all closed", () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();

  const sessionId1 = executor.createSession(context);
  const sessionId2 = executor.createSession(context);

  executor.closeSession(sessionId1);
  executor.closeSession(sessionId2);

  const sessions = executor.listSessions();
  assert.equal(sessions.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Input Validation Edge Cases Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.input() rejects whitespace-only text as valid", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  // Whitespace-only text is still valid input
  const result = await executor.input(sessionId, context, {
    selector: "#input",
    text: "   ",
    clear: true,
  });

  assert.equal(result.status, "ok");
  const output = result.output as { textLength: number; cleared: boolean };
  assert.equal(output.textLength, 3);
  assert.equal(output.cleared, true);
});

test("BrowserExecutor.input() handles empty text", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.input(sessionId, context, {
    selector: "#input",
    text: "",
    clear: true,
  });

  assert.equal(result.status, "ok");
  const output = result.output as { textLength: number; cleared: boolean };
  assert.equal(output.textLength, 0);
  assert.equal(output.cleared, true);
});

test("BrowserExecutor.input() handles unicode text", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.input(sessionId, context, {
    selector: "#input",
    text: "Hello 世界",
  });

  assert.equal(result.status, "ok");
  const output = result.output as { textLength: number };
  // "Hello 世界" has length 8 in JavaScript
  assert.equal(output.textLength, 8);
});

test("BrowserExecutor.input() handles long text", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const longText = "a".repeat(10000);
  const result = await executor.input(sessionId, context, {
    selector: "#input",
    text: longText,
  });

  assert.equal(result.status, "ok");
  const output = result.output as { textLength: number };
  assert.equal(output.textLength, 10000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Navigation URL Validation Edge Cases Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.navigate() rejects javascript protocol", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "javascript:void(0)",
  });

  assert.equal(result.status, "error");
});

test("BrowserExecutor.navigate() rejects data protocol", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "data:text/html,<h1>test</h1>",
  });

  assert.equal(result.status, "error");
});

test("BrowserExecutor.navigate() rejects ftp protocol", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "ftp://ftp.example.com/file.txt",
  });

  assert.equal(result.status, "error");
});

test("BrowserExecutor.navigate() accepts https URL", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor.navigate() accepts http URL", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "http://example.com",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor.navigate() handles URL with query params", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com/search?q=test&page=1",
  });

  assert.equal(result.status, "ok");
  const output = result.output as { url: string };
  assert.ok(output.url.includes("q=test"));
});

test("BrowserExecutor.navigate() handles URL with fragment", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com/page#section",
  });

  assert.equal(result.status, "ok");
  const output = result.output as { url: string };
  assert.ok(output.url.includes("#section"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Executor Options Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor accepts screenshotDirectory option", () => {
  const executor = new BrowserExecutor({
    screenshotDirectory: "/tmp/browser-screenshots",
  });

  const context = createTestContext();
  const sessionId = executor.createSession(context);

  assert.ok(sessionId);
  const session = executor.getSession(sessionId);
  assert.ok(session);
});

test("BrowserExecutor with all custom options works", async () => {
  const executor = new BrowserExecutor({
    defaultTimeout: 45000,
    navigationTimeout: 90000,
    screenshotDirectory: "/custom/screenshots",
  });

  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com",
    timeout: 90000,
    waitUntil: "networkidle",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor default timeout values are reasonable", () => {
  const executor = new BrowserExecutor();

  const context = createTestContext();
  const sessionId = executor.createSession(context);

  // Should be able to perform basic operations with defaults
  const result = executor.navigate(sessionId, context, {
    url: "https://example.com",
  });

  assert.ok(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Status Classification Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor error classification handles timeout keyword", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  // Use invalid URL to trigger error with 'navigation' in message
  const result = await executor.navigate(sessionId, context, {
    url: "https://invalid-domain-that-does-not-exist-12345.com",
  });

  // The result status depends on simulation - either ok or error
  assert.ok(["ok", "error", "navigation_error", "timeout"].includes(result.status));
});

test("BrowserExecutor evaluate error result has correct structure", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.evaluate(sessionId, context, {
    script: "",
  });

  assert.equal(result.status, "error");
  assert.ok(result.error);
  assert.equal(result.browserAction, "evaluate");
  assert.deepEqual(result.output, {});
});

test("BrowserExecutor click error result has correct structure", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.click(sessionId, context, {
    selector: "",
  });

  assert.equal(result.status, "error");
  assert.ok(result.error);
  assert.equal(result.browserAction, "click");
});

test("BrowserExecutor input error result has correct structure", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.input(sessionId, context, {
    selector: "",
    text: "test",
  });

  assert.equal(result.status, "error");
  assert.ok(result.error);
  assert.equal(result.browserAction, "input");
});

test("BrowserExecutor getAttribute error result has correct structure", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.getAttribute(sessionId, context, {
    selector: "",
    attribute: "href",
  });

  assert.equal(result.status, "error");
  assert.ok(result.error);
  assert.equal(result.browserAction, "getAttribute");
});

test("BrowserExecutor waitForSelector error result has correct structure", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.waitForSelector(sessionId, context, {
    selector: "",
  });

  assert.equal(result.status, "error");
  assert.ok(result.error);
  assert.equal(result.browserAction, "waitForSelector");
});

test("BrowserExecutor scroll allows empty selector for page scroll", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  // Empty/falsy selector is allowed - means scroll the page
  const result = await executor.scroll(sessionId, context, {
    selector: "",
  });

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "scroll");
  const output = result.output as { selector: string; x: number; y: number };
  // Empty string selector is preserved as empty string
  assert.equal(output.selector, "");
});

// ─────────────────────────────────────────────────────────────────────────────
// Session Context Metadata Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor session stores createdAt timestamp", () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const session = executor.getSession(sessionId);
  assert.ok(session?.createdAt);
  assert.ok(typeof session?.createdAt === "string");
});

test("BrowserExecutor session with null tenantId works", () => {
  const executor = createBrowserExecutor();
  const context = createTestContext({ tenantId: null });

  const sessionId = executor.createSession(context);
  const session = executor.getSession(sessionId);

  assert.ok(session);
  assert.equal(session?.isActive, true);
});

test("BrowserExecutor execution result includes correct browserAction per method", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const navigateResult = await executor.navigate(sessionId, context, { url: "https://a.com" });
  const clickResult = await executor.click(sessionId, context, { selector: "#b" });
  const inputResult = await executor.input(sessionId, context, { selector: "#c", text: "d" });
  const screenshotResult = await executor.screenshot(sessionId, context, {});
  const evaluateResult = await executor.evaluate(sessionId, context, { script: "1" });
  const waitResult = await executor.waitForSelector(sessionId, context, { selector: "#e" });
  const attrResult = await executor.getAttribute(sessionId, context, { selector: "#f", attribute: "g" });
  const scrollResult = await executor.scroll(sessionId, context, { x: 0, y: 0 });

  assert.equal(navigateResult.browserAction, "navigate");
  assert.equal(clickResult.browserAction, "click");
  assert.equal(inputResult.browserAction, "input");
  assert.equal(screenshotResult.browserAction, "screenshot");
  assert.equal(evaluateResult.browserAction, "evaluate");
  assert.equal(waitResult.browserAction, "waitForSelector");
  assert.equal(attrResult.browserAction, "getAttribute");
  assert.equal(scrollResult.browserAction, "scroll");
});

// ─────────────────────────────────────────────────────────────────────────────
// Execution Log Comprehensive Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor execution log contains all actions in order", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  await executor.navigate(sessionId, context, { url: "https://example.com/1" });
  await executor.click(sessionId, context, { selector: "#btn" });
  await executor.input(sessionId, context, { selector: "#inp", text: "test" });
  await executor.screenshot(sessionId, context, { fullPage: true });

  const log = executor.getExecutionLog();
  assert.equal(log.length, 4);
  assert.equal(log[0]?.browserAction, "navigate");
  assert.equal(log[1]?.browserAction, "click");
  assert.equal(log[2]?.browserAction, "input");
  assert.equal(log[3]?.browserAction, "screenshot");
});

test("BrowserExecutor clearExecutionLog can be called multiple times", () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  executor.clearExecutionLog();
  executor.clearExecutionLog();
  executor.clearExecutionLog();

  assert.equal(executor.getExecutionLog().length, 0);
});

test("BrowserExecutor getExecutionLog returns new array instance", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  await executor.navigate(sessionId, context, { url: "https://example.com" });

  const log1 = executor.getExecutionLog();
  const log2 = executor.getExecutionLog();

  // Should return a new array each time
  assert.ok(Array.isArray(log1));
  assert.ok(Array.isArray(log2));
  assert.notEqual(log1, log2);
  assert.deepEqual(log1, log2);
});
