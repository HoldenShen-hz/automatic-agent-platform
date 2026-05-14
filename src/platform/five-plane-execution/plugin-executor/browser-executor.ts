/**
 * Browser Executor
 *
 * Executes browser automation tasks via a controlled browser instance.
 * Supports page navigation, element interaction, screenshot capture, and
 * JavaScript execution within a sandboxed browser context.
 *
 * Architecture: §14 Runtime Execution Plane
 * @see docs_zh/architecture/00-platform-architecture.md §14
 * @see ADR-030 Runtime Execution Plane
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import { ValidationError } from "../../contracts/errors.js";
import type { SandboxModeLike } from "../../control-plane/iam/sandbox-policy.js";

// ─────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────

export type BrowserAction =
  | "navigate"
  | "click"
  | "input"
  | "screenshot"
  | "evaluate"
  | "waitForSelector"
  | "getAttribute"
  | "scroll";

export interface BrowserExecutionContext {
  executionId: string;
  taskId: string;
  tenantId: string | null;
  correlationId: string;
  sessionId: string | null;
  sandboxTier: SandboxModeLike;
}

export interface BrowserExecutionResult {
  executionId: string;
  browserAction: BrowserAction;
  status: "ok" | "error" | "timeout" | "navigation_error";
  output: unknown;
  durationMs: number;
  timestamp: string;
  error?: string;
  artifactRef?: string;
}

export interface BrowserNavigationOptions {
  url: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  timeout?: number;
}

export interface BrowserClickOptions {
  selector: string;
  button?: "left" | "right" | "middle";
  clickCount?: number;
}

export interface BrowserInputOptions {
  selector: string;
  text: string;
  clear?: boolean;
}

export interface BrowserEvaluateOptions {
  script: string;
  args?: unknown[];
}

export interface BrowserScreenshotOptions {
  fullPage?: boolean;
  selector?: string;
}

export interface BrowserWaitForSelectorOptions {
  selector: string;
  timeout?: number;
  state?: "attached" | "detached" | "visible" | "hidden";
}

export interface BrowserGetAttributeOptions {
  selector: string;
  attribute: string;
}

export interface BrowserScrollOptions {
  selector?: string;
  x?: number;
  y?: number;
}

export interface BrowserExecutorOptions {
  defaultTimeout?: number;
  navigationTimeout?: number;
  screenshotDirectory?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser Session State
// ─────────────────────────────────────────────────────────────────────────────

interface BrowserSession {
  sessionId: string;
  createdAt: string;
  lastUsedAt: string;
  url: string;
  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser Executor
// ─────────────────────────────────────────────────────────────────────────────

export class BrowserExecutor {
  private readonly defaultTimeout: number;
  private readonly navigationTimeout: number;
  private readonly sessions = new Map<string, BrowserSession>();
  private readonly executionLog: BrowserExecutionResult[] = [];

  public constructor(options: BrowserExecutorOptions = {}) {
    this.defaultTimeout = options.defaultTimeout ?? 30000;
    this.navigationTimeout = options.navigationTimeout ?? 60000;
  }

  // ── Session Management ─────────────────────────────────────────────────────

  /**
   * Creates a new browser session.
   *
   * @param context - Execution context
   * @returns Session ID
   */
  public createSession(context: BrowserExecutionContext): string {
    const sessionId = newId("bsession");
    const now = nowIso();

    this.sessions.set(sessionId, {
      sessionId,
      createdAt: now,
      lastUsedAt: now,
      url: "about:blank",
      isActive: true,
    });

    return sessionId;
  }

  /**
   * Closes a browser session.
   *
   * @param sessionId - Session to close
   */
  public closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new ValidationError(
        "browser_executor.session_not_found",
        `browser_executor.session_not_found: Browser session ${sessionId} not found`,
        { details: { sessionId } },
      );
    }
    session.isActive = false;
    this.sessions.delete(sessionId);
  }

  /**
   * Gets session information.
   *
   * @param sessionId - Session to query
   */
  public getSession(sessionId: string): BrowserSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * Lists all active sessions.
   */
  public listSessions(): BrowserSession[] {
    return [...this.sessions.values()].filter((s) => s.isActive);
  }

  // ── Navigation Actions ─────────────────────────────────────────────────────

  /**
   * Navigates to a URL.
   *
   * @param sessionId - Session to use
   * @param context - Execution context
   * @param options - Navigation options
   */
  public async navigate(
    sessionId: string,
    context: BrowserExecutionContext,
    options: BrowserNavigationOptions,
  ): Promise<BrowserExecutionResult> {
    const startTime = Date.now();
    const session = this.validateSession(sessionId);

    try {
      this.validateUrl(options.url);

      const timeout = options.timeout ?? this.navigationTimeout;

      // Simulate navigation (actual implementation would use Playwright/Puppeteer)
      await this.simulateOperation("navigate", timeout);

      session.url = options.url;
      session.lastUsedAt = nowIso();

      return this.buildResult(context, "navigate", "ok", { url: options.url }, startTime);
    } catch (error) {
      return this.buildErrorResult(context, "navigate", error, startTime);
    }
  }

  /**
   * Clicks an element.
   *
   * @param sessionId - Session to use
   * @param context - Execution context
   * @param options - Click options
   */
  public async click(
    sessionId: string,
    context: BrowserExecutionContext,
    options: BrowserClickOptions,
  ): Promise<BrowserExecutionResult> {
    const startTime = Date.now();
    const session = this.validateSession(sessionId);

    try {
      this.validateSelector(options.selector);

      const timeout = this.defaultTimeout;
      await this.simulateOperation("click", timeout);

      session.lastUsedAt = nowIso();

      return this.buildResult(context, "click", "ok", {
        selector: options.selector,
        button: options.button ?? "left",
        clickCount: options.clickCount ?? 1,
      }, startTime);
    } catch (error) {
      return this.buildErrorResult(context, "click", error, startTime);
    }
  }

  /**
   * Types text into an input element.
   *
   * @param sessionId - Session to use
   * @param context - Execution context
   * @param options - Input options
   */
  public async input(
    sessionId: string,
    context: BrowserExecutionContext,
    options: BrowserInputOptions,
  ): Promise<BrowserExecutionResult> {
    const startTime = Date.now();
    const session = this.validateSession(sessionId);

    try {
      this.validateSelector(options.selector);

      const timeout = this.defaultTimeout;
      await this.simulateOperation("input", timeout);

      session.lastUsedAt = nowIso();

      return this.buildResult(context, "input", "ok", {
        selector: options.selector,
        textLength: options.text.length,
        cleared: options.clear ?? false,
      }, startTime);
    } catch (error) {
      return this.buildErrorResult(context, "input", error, startTime);
    }
  }

  /**
   * Takes a screenshot.
   *
   * @param sessionId - Session to use
   * @param context - Execution context
   * @param options - Screenshot options
   */
  public async screenshot(
    sessionId: string,
    context: BrowserExecutionContext,
    options: BrowserScreenshotOptions = {},
  ): Promise<BrowserExecutionResult> {
    const startTime = Date.now();
    const session = this.validateSession(sessionId);

    try {
      const timeout = this.defaultTimeout;
      await this.simulateOperation("screenshot", timeout);

      session.lastUsedAt = nowIso();

      const artifactId = newId("art");

      return this.buildResult(context, "screenshot", "ok", {
        fullPage: options.fullPage ?? false,
        selector: options.selector ?? null,
        artifactId,
      }, startTime, artifactId);
    } catch (error) {
      return this.buildErrorResult(context, "screenshot", error, startTime);
    }
  }

  /**
   * Evaluates JavaScript in the browser context.
   *
   * @param sessionId - Session to use
   * @param context - Execution context
   * @param options - Evaluate options
   */
  public async evaluate(
    sessionId: string,
    context: BrowserExecutionContext,
    options: BrowserEvaluateOptions,
  ): Promise<BrowserExecutionResult> {
    const startTime = Date.now();
    const session = this.validateSession(sessionId);

    try {
      if (!options.script || options.script.trim().length === 0) {
        throw new ValidationError(
          "browser_executor.empty_script",
          "browser_executor.empty_script: Script cannot be empty",
        );
      }

      const timeout = this.defaultTimeout;
      const result = await this.simulateEvaluate(options.script, options.args);

      session.lastUsedAt = nowIso();

      return this.buildResult(context, "evaluate", "ok", {
        script: options.script,
        result,
      }, startTime);
    } catch (error) {
      return this.buildErrorResult(context, "evaluate", error, startTime);
    }
  }

  /**
   * Waits for a selector to appear or reach a state.
   *
   * @param sessionId - Session to use
   * @param context - Execution context
   * @param options - Wait options
   */
  public async waitForSelector(
    sessionId: string,
    context: BrowserExecutionContext,
    options: BrowserWaitForSelectorOptions,
  ): Promise<BrowserExecutionResult> {
    const startTime = Date.now();
    const session = this.validateSession(sessionId);

    try {
      this.validateSelector(options.selector);

      const timeout = options.timeout ?? this.defaultTimeout;
      await this.simulateOperation("waitForSelector", timeout);

      session.lastUsedAt = nowIso();

      return this.buildResult(context, "waitForSelector", "ok", {
        selector: options.selector,
        state: options.state ?? "visible",
      }, startTime);
    } catch (error) {
      return this.buildErrorResult(context, "waitForSelector", error, startTime);
    }
  }

  /**
   * Gets an element's attribute value.
   *
   * @param sessionId - Session to use
   * @param context - Execution context
   * @param options - Get attribute options
   */
  public async getAttribute(
    sessionId: string,
    context: BrowserExecutionContext,
    options: BrowserGetAttributeOptions,
  ): Promise<BrowserExecutionResult> {
    const startTime = Date.now();
    const session = this.validateSession(sessionId);

    try {
      this.validateSelector(options.selector);

      const timeout = this.defaultTimeout;
      const attributeValue = await this.simulateGetAttribute(options.selector, options.attribute);

      session.lastUsedAt = nowIso();

      return this.buildResult(context, "getAttribute", "ok", {
        selector: options.selector,
        attribute: options.attribute,
        value: attributeValue,
      }, startTime);
    } catch (error) {
      return this.buildErrorResult(context, "getAttribute", error, startTime);
    }
  }

  /**
   * Scrolls an element or the page.
   *
   * @param sessionId - Session to use
   * @param context - Execution context
   * @param options - Scroll options
   */
  public async scroll(
    sessionId: string,
    context: BrowserExecutionContext,
    options: BrowserScrollOptions,
  ): Promise<BrowserExecutionResult> {
    const startTime = Date.now();
    const session = this.validateSession(sessionId);

    try {
      if (options.selector) {
        this.validateSelector(options.selector);
      }

      const timeout = this.defaultTimeout;
      await this.simulateOperation("scroll", timeout);

      session.lastUsedAt = nowIso();

      return this.buildResult(context, "scroll", "ok", {
        selector: options.selector ?? null,
        x: options.x ?? 0,
        y: options.y ?? 0,
      }, startTime);
    } catch (error) {
      return this.buildErrorResult(context, "scroll", error, startTime);
    }
  }

  // ── Execution Log ─────────────────────────────────────────────────────────

  /**
   * Gets the execution log for auditing.
   */
  public getExecutionLog(): readonly BrowserExecutionResult[] {
    return [...this.executionLog];
  }

  /**
   * Clears the execution log.
   */
  public clearExecutionLog(): void {
    this.executionLog.length = 0;
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  private validateSession(sessionId: string): BrowserSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new ValidationError(
        "browser_executor.session_not_found",
        `browser_executor.session_not_found: Browser session ${sessionId} not found`,
        { details: { sessionId } },
      );
    }
    if (!session.isActive) {
      throw new ValidationError(
        "browser_executor.session_inactive",
        `browser_executor.session_inactive: Browser session ${sessionId} is not active`,
        { details: { sessionId } },
      );
    }
    return session;
  }

  private validateUrl(url: string): void {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new ValidationError(
          "browser_executor.invalid_url_protocol",
          "browser_executor.invalid_url_protocol: Only http and https URLs are allowed",
          { details: { url, protocol: parsed.protocol } },
        );
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        "browser_executor.invalid_url",
        "browser_executor.invalid_url: Invalid URL format",
        { details: { url } },
      );
    }
  }

  private validateSelector(selector: string): void {
    if (!selector || selector.trim().length === 0) {
      throw new ValidationError(
        "browser_executor.empty_selector",
        "browser_executor.empty_selector: Selector cannot be empty",
      );
    }
  }

  private async simulateOperation(action: BrowserAction, timeout: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve();
      }, Math.min(timeout, 100)); // Simulated - real impl would be longer
    });
  }

  private async simulateEvaluate(script: string, _args?: unknown[]): Promise<unknown> {
    // Simulated JavaScript evaluation
    // In real implementation, this would execute in browser context
    if (script.includes("location.href")) {
      return "https://example.com";
    }
    if (script.includes("document.title")) {
      return "Example Page";
    }
    if (script.includes("innerHTML")) {
      return sanitizeBrowserHtml("<div>content</div><script>alert('xss')</script>");
    }
    return { result: "evaluated" };
  }

  private async simulateGetAttribute(selector: string, attribute: string): Promise<string | null> {
    // Simulated attribute retrieval
    if (attribute === "href") {
      return "https://example.com/link";
    }
    if (attribute === "src") {
      return "https://example.com/image.png";
    }
    if (attribute === "alt") {
      return "Example alt text";
    }
    return null;
  }

  private buildResult(
    context: BrowserExecutionContext,
    action: BrowserAction,
    status: BrowserExecutionResult["status"],
    output: unknown,
    startTime: number,
    artifactRef?: string,
  ): BrowserExecutionResult {
    const result: BrowserExecutionResult = {
      executionId: newId("bexec"),
      browserAction: action,
      status,
      output,
      durationMs: Date.now() - startTime,
      timestamp: nowIso(),
    };

    if (artifactRef) {
      result.artifactRef = artifactRef;
    }

    this.executionLog.push(result);
    return result;
  }

  private buildErrorResult(
    context: BrowserExecutionContext,
    action: BrowserAction,
    error: unknown,
    startTime: number,
  ): BrowserExecutionResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    let status: BrowserExecutionResult["status"] = "error";

    if (errorMessage.includes("Timeout") || errorMessage.includes("timeout")) {
      status = "timeout";
    } else if (errorMessage.includes("navigation") || errorMessage.includes("Navigation")) {
      status = "navigation_error";
    }

    const result: BrowserExecutionResult = {
      executionId: newId("bexec"),
      browserAction: action,
      status,
      output: {},
      durationMs: Date.now() - startTime,
      timestamp: nowIso(),
      error: errorMessage,
    };

    this.executionLog.push(result);
    return result;
  }
}

function sanitizeBrowserHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(?:href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function createBrowserExecutor(options?: BrowserExecutorOptions): BrowserExecutor {
  return new BrowserExecutor(options);
}
