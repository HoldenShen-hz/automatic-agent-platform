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
// ─────────────────────────────────────────────────────────────────────────────
// Browser Executor
// ─────────────────────────────────────────────────────────────────────────────
export class BrowserExecutor {
    defaultTimeout;
    navigationTimeout;
    sessions = new Map();
    executionLog = [];
    constructor(options = {}) {
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
    createSession(context) {
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
    closeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new ValidationError("browser_executor.session_not_found", `Browser session ${sessionId} not found`, { details: { sessionId } });
        }
        session.isActive = false;
        this.sessions.delete(sessionId);
    }
    /**
     * Gets session information.
     *
     * @param sessionId - Session to query
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId) ?? null;
    }
    /**
     * Lists all active sessions.
     */
    listSessions() {
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
    async navigate(sessionId, context, options) {
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
        }
        catch (error) {
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
    async click(sessionId, context, options) {
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
        }
        catch (error) {
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
    async input(sessionId, context, options) {
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
        }
        catch (error) {
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
    async screenshot(sessionId, context, options = {}) {
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
        }
        catch (error) {
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
    async evaluate(sessionId, context, options) {
        const startTime = Date.now();
        const session = this.validateSession(sessionId);
        try {
            if (!options.script || options.script.trim().length === 0) {
                throw new ValidationError("browser_executor.empty_script", "Script cannot be empty");
            }
            const timeout = this.defaultTimeout;
            const result = await this.simulateEvaluate(options.script, options.args);
            session.lastUsedAt = nowIso();
            return this.buildResult(context, "evaluate", "ok", {
                script: options.script,
                result,
            }, startTime);
        }
        catch (error) {
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
    async waitForSelector(sessionId, context, options) {
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
        }
        catch (error) {
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
    async getAttribute(sessionId, context, options) {
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
        }
        catch (error) {
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
    async scroll(sessionId, context, options) {
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
        }
        catch (error) {
            return this.buildErrorResult(context, "scroll", error, startTime);
        }
    }
    // ── Execution Log ─────────────────────────────────────────────────────────
    /**
     * Gets the execution log for auditing.
     */
    getExecutionLog() {
        return [...this.executionLog];
    }
    /**
     * Clears the execution log.
     */
    clearExecutionLog() {
        this.executionLog.length = 0;
    }
    // ── Private Helpers ───────────────────────────────────────────────────────
    validateSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new ValidationError("browser_executor.session_not_found", `Browser session ${sessionId} not found`, { details: { sessionId } });
        }
        if (!session.isActive) {
            throw new ValidationError("browser_executor.session_inactive", `Browser session ${sessionId} is not active`, { details: { sessionId } });
        }
        return session;
    }
    validateUrl(url) {
        try {
            const parsed = new URL(url);
            if (!["http:", "https:"].includes(parsed.protocol)) {
                throw new ValidationError("browser_executor.invalid_url_protocol", "Only http and https URLs are allowed", { details: { url, protocol: parsed.protocol } });
            }
        }
        catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            throw new ValidationError("browser_executor.invalid_url", "Invalid URL format", { details: { url } });
        }
    }
    validateSelector(selector) {
        if (!selector || selector.trim().length === 0) {
            throw new ValidationError("browser_executor.empty_selector", "Selector cannot be empty");
        }
    }
    async simulateOperation(action, timeout) {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                resolve();
            }, Math.min(timeout, 100)); // Simulated - real impl would be longer
        });
    }
    async simulateEvaluate(script, _args) {
        // Simulated JavaScript evaluation
        // In real implementation, this would execute in browser context
        if (script.includes("location.href")) {
            return "https://example.com";
        }
        if (script.includes("document.title")) {
            return "Example Page";
        }
        if (script.includes("innerHTML")) {
            return "<div>content</div>";
        }
        return { result: "evaluated" };
    }
    async simulateGetAttribute(selector, attribute) {
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
    buildResult(context, action, status, output, startTime, artifactRef) {
        const result = {
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
    buildErrorResult(context, action, error, startTime) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        let status = "error";
        if (errorMessage.includes("Timeout") || errorMessage.includes("timeout")) {
            status = "timeout";
        }
        else if (errorMessage.includes("navigation") || errorMessage.includes("Navigation")) {
            status = "navigation_error";
        }
        const result = {
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
// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────
export function createBrowserExecutor(options) {
    return new BrowserExecutor(options);
}
//# sourceMappingURL=browser-executor.js.map