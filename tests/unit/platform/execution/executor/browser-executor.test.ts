/**
 * BrowserExecutor Unit Tests
 *
 * Tests for:
 * - Session management (create, close, list)
 * - Navigation actions (navigate, click, input)
 * - Browser actions (screenshot, evaluate, waitForSelector)
 * - Element actions (getAttribute, scroll)
 * - Error handling and validation
 * - Execution logging
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
  type BrowserInputOptions,
  type BrowserScreenshotOptions,
  type BrowserEvaluateOptions,
  type BrowserWaitForSelectorOptions,
  type BrowserGetAttributeOptions,
  type BrowserScrollOptions,
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
// Session Management Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor creates a new session and returns session ID [browser-executor]", () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();

  const sessionId = executor.createSession(context);

  assert.ok(sessionId);
  assert.ok(sessionId.startsWith("bsession_"));

  const session = executor.getSession(sessionId);
  assert.ok(session);
  assert.equal(session.sessionId, sessionId);
  assert.equal(session.url, "about:blank");
  assert.equal(session.isActive, true);
});

test("BrowserExecutor.closeSession() closes an active session [browser-executor]", () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();

  const sessionId = executor.createSession(context);
  executor.closeSession(sessionId);

  const session = executor.getSession(sessionId);
  assert.equal(session, null);
});

test("BrowserExecutor.closeSession() throws for non-existent session [browser-executor]", () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();

  assert.throws(
    () => executor.closeSession("non-existent-session"),
    { message: /not found/ },
  );
});

test("BrowserExecutor.listSessions() returns all active sessions [browser-executor]", () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();

  const sessionId1 = executor.createSession(context);
  const sessionId2 = executor.createSession(context);

  const sessions = executor.listSessions();
  assert.equal(sessions.length, 2);

  const sessionIds = sessions.map((s) => s.sessionId);
  assert.ok(sessionIds.includes(sessionId1));
  assert.ok(sessionIds.includes(sessionId2));
});

test("BrowserExecutor.listSessions() excludes closed sessions [browser-executor]", () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();

  const sessionId1 = executor.createSession(context);
  const sessionId2 = executor.createSession(context);

  executor.closeSession(sessionId1);

  const sessions = executor.listSessions();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.sessionId, sessionId2);
});

test("BrowserExecutor.getSession() returns null for non-existent session [browser-executor]", () => {
  const executor = createBrowserExecutor();

  const session = executor.getSession("non-existent");
  assert.equal(session, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.navigate() navigates to a URL [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserNavigationOptions = {
    url: "https://example.com",
    waitUntil: "load",
    timeout: 5000,
  };

  const result = await executor.navigate(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "navigate");
  assert.deepEqual(result.output, { url: "https://example.com" });
  assert.ok(result.executionId.startsWith("bexec_"));
  assert.ok(result.durationMs >= 0);
});

test("BrowserExecutor.navigate() rejects invalid URL protocol [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserNavigationOptions = {
    url: "file:///etc/passwd",
  };

  const result = await executor.navigate(sessionId, context, options);

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("http and https URLs are allowed"));
});

test("BrowserExecutor.navigate() rejects invalid URL format [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserNavigationOptions = {
    url: "not-a-valid-url",
  };

  const result = await executor.navigate(sessionId, context, options);

  assert.equal(result.status, "error");
  assert.ok(result.error);
});

test("BrowserExecutor.navigate() throws for non-existent session [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();

  const options: BrowserNavigationOptions = {
    url: "https://example.com",
  };

  await assert.rejects(
    async () => executor.navigate("non-existent", context, options),
    { message: /not found/ },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Click Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.click() clicks an element [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserClickOptions = {
    selector: "#button",
    button: "left",
    clickCount: 1,
  };

  const result = await executor.click(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "click");
  assert.deepEqual(result.output, {
    selector: "#button",
    button: "left",
    clickCount: 1,
  });
});

test("BrowserExecutor.click() defaults to left button [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserClickOptions = {
    selector: "#button",
  };

  const result = await executor.click(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.deepEqual(result.output, {
    selector: "#button",
    button: "left",
    clickCount: 1,
  });
});

test("BrowserExecutor.click() rejects empty selector [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserClickOptions = {
    selector: "",
  };

  const result = await executor.click(sessionId, context, options);

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("Selector cannot be empty"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Input Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.input() types into an element [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserInputOptions = {
    selector: "#input",
    text: "hello world",
    clear: true,
  };

  const result = await executor.input(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "input");
  assert.deepEqual(result.output, {
    selector: "#input",
    textLength: 11,
    cleared: true,
  });
});

test("BrowserExecutor.input() defaults clear to false [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserInputOptions = {
    selector: "#input",
    text: "hello",
  };

  const result = await executor.input(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.deepEqual(result.output, {
    selector: "#input",
    textLength: 5,
    cleared: false,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Screenshot Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.screenshot() captures a screenshot [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserScreenshotOptions = {
    fullPage: true,
  };

  const result = await executor.screenshot(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "screenshot");
  assert.deepEqual(result.output, {
    fullPage: true,
    selector: null,
    artifactId: result.artifactRef,
  });
  assert.ok(result.artifactRef);
});

test("BrowserExecutor.screenshot() defaults fullPage to false [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.screenshot(sessionId, context, {});

  assert.equal(result.status, "ok");
  assert.deepEqual(result.output, {
    fullPage: false,
    selector: null,
    artifactId: result.artifactRef,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Evaluate Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.evaluate() executes JavaScript [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserEvaluateOptions = {
    script: "document.title",
  };

  const result = await executor.evaluate(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "evaluate");
  assert.deepEqual(result.output, {
    script: "document.title",
    result: "Example Page",
  });
});

test("BrowserExecutor.evaluate() rejects empty script [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserEvaluateOptions = {
    script: "   ",
  };

  const result = await executor.evaluate(sessionId, context, options);

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("Script cannot be empty"));
});

test("BrowserExecutor.evaluate() handles location.href [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserEvaluateOptions = {
    script: "location.href",
  };

  const result = await executor.evaluate(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.deepEqual(result.output, {
    script: "location.href",
    result: "https://example.com",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WaitForSelector Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.waitForSelector() waits for element [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserWaitForSelectorOptions = {
    selector: "#element",
    timeout: 5000,
    state: "visible",
  };

  const result = await executor.waitForSelector(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "waitForSelector");
  assert.deepEqual(result.output, {
    selector: "#element",
    state: "visible",
  });
});

test("BrowserExecutor.waitForSelector() defaults state to visible [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserWaitForSelectorOptions = {
    selector: "#element",
  };

  const result = await executor.waitForSelector(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.deepEqual(result.output, {
    selector: "#element",
    state: "visible",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GetAttribute Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.getAttribute() gets element attribute [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserGetAttributeOptions = {
    selector: "a.link",
    attribute: "href",
  };

  const result = await executor.getAttribute(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "getAttribute");
  assert.deepEqual(result.output, {
    selector: "a.link",
    attribute: "href",
    value: "https://example.com/link",
  });
});

test("BrowserExecutor.getAttribute() returns null for unknown attribute [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserGetAttributeOptions = {
    selector: "img",
    attribute: "data-unknown",
  };

  const result = await executor.getAttribute(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.deepEqual(result.output, {
    selector: "img",
    attribute: "data-unknown",
    value: null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scroll Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.scroll() scrolls page [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserScrollOptions = {
    x: 0,
    y: 100,
  };

  const result = await executor.scroll(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "scroll");
  assert.deepEqual(result.output, {
    selector: null,
    x: 0,
    y: 100,
  });
});

test("BrowserExecutor.scroll() scrolls element [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const options: BrowserScrollOptions = {
    selector: "#container",
    x: 50,
    y: 200,
  };

  const result = await executor.scroll(sessionId, context, options);

  assert.equal(result.status, "ok");
  assert.deepEqual(result.output, {
    selector: "#container",
    x: 50,
    y: 200,
  });
});

test("BrowserExecutor.scroll() defaults to page scroll [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.scroll(sessionId, context, {});

  assert.equal(result.status, "ok");
  assert.deepEqual(result.output, {
    selector: null,
    x: 0,
    y: 0,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Execution Log Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.getExecutionLog() returns all execution results [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  await executor.navigate(sessionId, context, { url: "https://example.com" });
  await executor.screenshot(sessionId, context, {});

  const log = executor.getExecutionLog();
  assert.equal(log.length, 2);
  assert.equal(log[0]?.browserAction, "navigate");
  assert.equal(log[1]?.browserAction, "screenshot");
});

test("BrowserExecutor.clearExecutionLog() clears the log [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  await executor.navigate(sessionId, context, { url: "https://example.com" });
  executor.clearExecutionLog();

  const log = executor.getExecutionLog();
  assert.equal(log.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor returns error status for invalid operations [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  // Empty selector should result in error
  const result = await executor.click(sessionId, context, { selector: "" });

  assert.equal(result.status, "error");
  assert.ok(result.error);
});

test("BrowserExecutor records error in execution log [browser-executor]", async () => {
  const executor = createBrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  await executor.click(sessionId, context, { selector: "" });

  const log = executor.getExecutionLog();
  assert.equal(log.length, 1);
  assert.equal(log[0]?.status, "error");
});

// ─────────────────────────────────────────────────────────────────────────────
// Constructor Options Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor accepts custom timeout options [browser-executor]", () => {
  const executor = createBrowserExecutor({
    defaultTimeout: 60000,
    navigationTimeout: 120000,
  });

  const context = createTestContext();
  const sessionId = executor.createSession(context);

  assert.ok(sessionId);
});

test("BrowserExecutor can be instantiated with new [browser-executor]", () => {
  const executor = new BrowserExecutor({
    defaultTimeout: 5000,
  });

  const context = createTestContext();
  const sessionId = executor.createSession(context);

  assert.ok(sessionId);
  const session = executor.getSession(sessionId);
  assert.ok(session);
});
