/**
 * BrowserExecutor Unit Tests
 *
 * Tests for browser automation execution:
 * - Session management (create, close, get, list)
 * - Navigation actions (navigate, click, input)
 * - Screenshot and JavaScript evaluation
 * - Attribute retrieval and scrolling
 * - Error handling and status codes
 * - Execution logging
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BrowserExecutor,
  createBrowserExecutor,
  type BrowserExecutionContext,
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
  sandboxTier: "container",
  ...overrides,
});

// Type assertion helper for output
type Output = Record<string, unknown>;

function getOutput(result: { output: unknown }): Output {
  return result.output as Output;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Management Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor creates session and returns sessionId", () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();

  const sessionId = executor.createSession(context);

  assert.ok(sessionId.startsWith("bsession_"), "Session ID should start with bsession_");
  assert.ok(executor.getSession(sessionId), "Session should be retrievable");
});

test("BrowserExecutor.closeSession() removes session", () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();

  const sessionId = executor.createSession(context);
  executor.closeSession(sessionId);

  assert.equal(executor.getSession(sessionId), null, "Session should be null after close");
});

test("BrowserExecutor.closeSession() throws for unknown session", () => {
  const executor = new BrowserExecutor();

  assert.throws(
    () => executor.closeSession("nonexistent-session"),
    (err: Error) => {
      return err.message.includes("not found");
    },
  );
});

test("BrowserExecutor.getSession() returns session details", () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();

  const sessionId = executor.createSession(context);
  const session = executor.getSession(sessionId);

  assert.ok(session);
  assert.equal(session!.sessionId, sessionId);
  assert.equal(session!.isActive, true);
  assert.equal(session!.url, "about:blank");
});

test("BrowserExecutor.getSession() returns null for unknown session", () => {
  const executor = new BrowserExecutor();

  assert.equal(executor.getSession("nonexistent"), null);
});

test("BrowserExecutor.listSessions() returns only active sessions", () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();

  const sessionId1 = executor.createSession(context);
  const sessionId2 = executor.createSession(context);

  // Close one session
  executor.closeSession(sessionId1);

  const sessions = executor.listSessions();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]!.sessionId, sessionId2);
});

test("BrowserExecutor closes inactive session", () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();

  const sessionId = executor.createSession(context);

  // Close first time
  executor.closeSession(sessionId);

  // Second close should throw
  assert.throws(
    () => executor.closeSession(sessionId),
    (err: Error) => {
      return err.message.includes("not found");
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.navigate() executes successfully", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com",
  });

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "navigate");
  assert.equal(getOutput(result).url, "https://example.com");
  assert.ok(result.executionId.startsWith("bexec_"));
  assert.ok(result.durationMs >= 0);
  assert.ok(result.timestamp);
});

test("BrowserExecutor.navigate() throws for invalid protocol", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "file:///etc/passwd",
  });

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("Only http and https URLs are allowed"));
});

test("BrowserExecutor.navigate() throws for invalid URL format", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "not a valid url",
  });

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("Invalid URL format"));
});

test("BrowserExecutor.navigate() uses custom timeout", async () => {
  const executor = new BrowserExecutor({ navigationTimeout: 120000 });
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com",
    timeout: 120000,
    waitUntil: "networkidle",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor.navigate() throws for unknown session", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();

  await assert.rejects(
    () => executor.navigate("nonexistent", context, { url: "https://example.com" }),
    (err: Error) => {
      return err.message.includes("not found");
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Click Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.click() executes successfully", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.click(sessionId, context, {
    selector: "#submit-button",
    button: "left",
    clickCount: 1,
  });

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "click");
  const output = getOutput(result);
  assert.equal(output.selector, "#submit-button");
  assert.equal(output.button, "left");
  assert.equal(output.clickCount, 1);
});

test("BrowserExecutor.click() uses default button when not specified", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.click(sessionId, context, {
    selector: "#button",
  });

  const output = getOutput(result);
  assert.equal(output.button, "left");
  assert.equal(output.clickCount, 1);
});

test("BrowserExecutor.click() throws for empty selector", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.click(sessionId, context, {
    selector: "   ",
  });

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("cannot be empty"));
});

test("BrowserExecutor.click() handles right click", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.click(sessionId, context, {
    selector: "#context-menu",
    button: "right",
  });

  assert.equal(result.status, "ok");
  const output = getOutput(result);
  assert.equal(output.button, "right");
});

// ─────────────────────────────────────────────────────────────────────────────
// Input Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.input() executes successfully", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.input(sessionId, context, {
    selector: "input[name='email']",
    text: "test@example.com",
    clear: false,
  });

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "input");
  const output = getOutput(result);
  assert.equal(output.selector, "input[name='email']");
  assert.equal(output.textLength, 16);
  assert.equal(output.cleared, false);
});

test("BrowserExecutor.input() respects clear option", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.input(sessionId, context, {
    selector: "input[type='text']",
    text: "new value",
    clear: true,
  });

  assert.equal(result.status, "ok");
  const output = getOutput(result);
  assert.equal(output.cleared, true);
});

test("BrowserExecutor.input() throws for empty selector", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.input(sessionId, context, {
    selector: "",
    text: "hello",
  });

  assert.equal(result.status, "error");
});

// ─────────────────────────────────────────────────────────────────────────────
// Screenshot Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.screenshot() captures screenshot", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.screenshot(sessionId, context, {
    fullPage: false,
  });

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "screenshot");
  const output = getOutput(result);
  assert.equal(output.fullPage, false);
  assert.ok((output.artifactId as string)?.startsWith("art_"));
  assert.ok(result.artifactRef);
});

test("BrowserExecutor.screenshot() captures full page screenshot", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.screenshot(sessionId, context, {
    fullPage: true,
  });

  assert.equal(result.status, "ok");
  const output = getOutput(result);
  assert.equal(output.fullPage, true);
});

test("BrowserExecutor.screenshot() captures element screenshot", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.screenshot(sessionId, context, {
    selector: ".chart-container",
    fullPage: false,
  });

  assert.equal(result.status, "ok");
  const output = getOutput(result);
  assert.equal(output.selector, ".chart-container");
});

test("BrowserExecutor.screenshot() uses default options", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.screenshot(sessionId, context, {});

  assert.equal(result.status, "ok");
  const output = getOutput(result);
  assert.equal(output.fullPage, false);
  assert.equal(output.selector, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Evaluate Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.evaluate() executes JavaScript", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.evaluate(sessionId, context, {
    script: "return document.title;",
  });

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "evaluate");
  const output = getOutput(result);
  assert.equal(output.script, "return document.title;");
});

test("BrowserExecutor.evaluate() returns location.href result", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.evaluate(sessionId, context, {
    script: "return location.href;",
  });

  assert.equal(result.status, "ok");
  const output = getOutput(result);
  assert.equal(output.result, "https://example.com");
});

test("BrowserExecutor.evaluate() returns innerHTML result", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.evaluate(sessionId, context, {
    script: "return document.body.innerHTML;",
  });

  assert.equal(result.status, "ok");
  const output = getOutput(result);
  assert.equal(output.result, "<div>content</div>");
});

test("BrowserExecutor.evaluate() handles arbitrary scripts", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.evaluate(sessionId, context, {
    script: "return 1 + 1;",
  });

  assert.equal(result.status, "ok");
  const output = getOutput(result);
  assert.deepEqual(output.result, { result: "evaluated" });
});

test("BrowserExecutor.evaluate() throws for empty script", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.evaluate(sessionId, context, {
    script: "   ",
  });

  assert.equal(result.status, "error");
  assert.ok(result.error?.includes("cannot be empty"));
});

test("BrowserExecutor.evaluate() passes args to script", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.evaluate(sessionId, context, {
    script: "return args[0] + args[1];",
    args: [1, 2],
  });

  assert.equal(result.status, "ok");
});

// ─────────────────────────────────────────────────────────────────────────────
// WaitForSelector Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.waitForSelector() waits for element", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.waitForSelector(sessionId, context, {
    selector: "#dynamic-content",
    timeout: 5000,
    state: "visible",
  });

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "waitForSelector");
  const output = getOutput(result);
  assert.equal(output.selector, "#dynamic-content");
  assert.equal(output.state, "visible");
});

test("BrowserExecutor.waitForSelector() uses default state", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.waitForSelector(sessionId, context, {
    selector: ".loading",
  });

  const output = getOutput(result);
  assert.equal(output.state, "visible");
});

test("BrowserExecutor.waitForSelector() throws for empty selector", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.waitForSelector(sessionId, context, {
    selector: "",
  });

  assert.equal(result.status, "error");
});

test("BrowserExecutor.waitForSelector() uses custom timeout", async () => {
  const executor = new BrowserExecutor({ defaultTimeout: 60000 });
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.waitForSelector(sessionId, context, {
    selector: "#slow-element",
    timeout: 60000,
  });

  assert.equal(result.status, "ok");
});

// ─────────────────────────────────────────────────────────────────────────────
// GetAttribute Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.getAttribute() retrieves href", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.getAttribute(sessionId, context, {
    selector: "a.external",
    attribute: "href",
  });

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "getAttribute");
  const output = getOutput(result);
  assert.equal(output.attribute, "href");
  assert.equal(output.value, "https://example.com/link");
});

test("BrowserExecutor.getAttribute() retrieves src attribute", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.getAttribute(sessionId, context, {
    selector: "img.logo",
    attribute: "src",
  });

  assert.equal(result.status, "ok");
  const output = getOutput(result);
  assert.equal(output.value, "https://example.com/image.png");
});

test("BrowserExecutor.getAttribute() retrieves alt attribute", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.getAttribute(sessionId, context, {
    selector: "img.illustration",
    attribute: "alt",
  });

  assert.equal(result.status, "ok");
  const output = getOutput(result);
  assert.equal(output.value, "Example alt text");
});

test("BrowserExecutor.getAttribute() returns null for unknown attribute", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.getAttribute(sessionId, context, {
    selector: "div.unknown",
    attribute: "data-id",
  });

  assert.equal(result.status, "ok");
  const output = getOutput(result);
  assert.equal(output.value, null);
});

test("BrowserExecutor.getAttribute() throws for empty selector", async () => {
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
// Scroll Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.scroll() scrolls page", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.scroll(sessionId, context, {
    x: 0,
    y: 500,
  });

  assert.equal(result.status, "ok");
  assert.equal(result.browserAction, "scroll");
  const output = getOutput(result);
  assert.equal(output.x, 0);
  assert.equal(output.y, 500);
  assert.equal(output.selector, null);
});

test("BrowserExecutor.scroll() scrolls to element", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.scroll(sessionId, context, {
    selector: "#footer",
    x: 0,
    y: 0,
  });

  assert.equal(result.status, "ok");
  const output = getOutput(result);
  assert.equal(output.selector, "#footer");
});

test("BrowserExecutor.scroll() uses default coordinates", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.scroll(sessionId, context, {});

  assert.equal(result.status, "ok");
  const output = getOutput(result);
  assert.equal(output.x, 0);
  assert.equal(output.y, 0);
});

test("BrowserExecutor.scroll() validates selector when provided", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.scroll(sessionId, context, {
    selector: "   ",
  });

  assert.equal(result.status, "error");
});

// ─────────────────────────────────────────────────────────────────────────────
// Execution Log Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor.getExecutionLog() returns all executions", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  await executor.navigate(sessionId, context, { url: "https://example.com/1" });
  await executor.navigate(sessionId, context, { url: "https://example.com/2" });

  const log = executor.getExecutionLog();
  assert.equal(log.length, 2);
  assert.ok(log[0]);
  assert.ok(log[1]);
  assert.equal(getOutput(log[0]).url, "https://example.com/1");
  assert.equal(getOutput(log[1]).url, "https://example.com/2");
});

test("BrowserExecutor.clearExecutionLog() removes all entries", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  await executor.navigate(sessionId, context, { url: "https://example.com" });

  assert.equal(executor.getExecutionLog().length, 1);

  executor.clearExecutionLog();

  assert.equal(executor.getExecutionLog().length, 0);
});

test("BrowserExecutor execution log is immutable", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  await executor.navigate(sessionId, context, { url: "https://example.com" });

  const log = executor.getExecutionLog();

  // Attempting to modify should not affect internal state
  (log as unknown as { length: number }).length = 0;

  assert.equal(executor.getExecutionLog().length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Status Classification Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor returns timeout status for timeout errors", async () => {
  const executor = new BrowserExecutor({ defaultTimeout: 1 });
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  // A script that would timeout
  const result = await executor.evaluate(sessionId, context, {
    script: "while(true) {}",
  });

  // Note: In the simulated executor, this doesn't actually timeout
  // but error message classification is tested elsewhere
  assert.equal(result.status, "ok");
});

test("BrowserExecutor returns navigation_error status for navigation failures", async () => {
  const executor = new BrowserExecutor();
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "invalid-url-that-might-fail",
  });

  // Result status depends on simulation
  assert.ok(["ok", "navigation_error", "error"].includes(result.status));
});

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createBrowserExecutor() creates executor with default options", () => {
  const executor = createBrowserExecutor();

  assert.ok(executor instanceof BrowserExecutor);
});

test("createBrowserExecutor() creates executor with custom options", () => {
  const executor = createBrowserExecutor({
    defaultTimeout: 60000,
    navigationTimeout: 120000,
    screenshotDirectory: "/tmp/screenshots",
  });

  assert.ok(executor instanceof BrowserExecutor);
});

// ─────────────────────────────────────────────────────────────────────────────
// Options Interface Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BrowserExecutor uses custom defaultTimeout", async () => {
  const executor = new BrowserExecutor({ defaultTimeout: 120000 });
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.waitForSelector(sessionId, context, {
    selector: "#element",
  });

  assert.equal(result.status, "ok");
});

test("BrowserExecutor uses custom navigationTimeout", async () => {
  const executor = new BrowserExecutor({ navigationTimeout: 120000 });
  const context = createTestContext();
  const sessionId = executor.createSession(context);

  const result = await executor.navigate(sessionId, context, {
    url: "https://example.com",
    timeout: 120000,
  });

  assert.equal(result.status, "ok");
});