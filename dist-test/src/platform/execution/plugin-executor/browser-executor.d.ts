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
export type BrowserAction = "navigate" | "click" | "input" | "screenshot" | "evaluate" | "waitForSelector" | "getAttribute" | "scroll";
export interface BrowserExecutionContext {
    executionId: string;
    taskId: string;
    tenantId: string | null;
    correlationId: string;
    sessionId: string | null;
    sandboxTier: "none" | "process" | "container";
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
interface BrowserSession {
    sessionId: string;
    createdAt: string;
    lastUsedAt: string;
    url: string;
    isActive: boolean;
}
export declare class BrowserExecutor {
    private readonly defaultTimeout;
    private readonly navigationTimeout;
    private readonly sessions;
    private readonly executionLog;
    constructor(options?: BrowserExecutorOptions);
    /**
     * Creates a new browser session.
     *
     * @param context - Execution context
     * @returns Session ID
     */
    createSession(context: BrowserExecutionContext): string;
    /**
     * Closes a browser session.
     *
     * @param sessionId - Session to close
     */
    closeSession(sessionId: string): void;
    /**
     * Gets session information.
     *
     * @param sessionId - Session to query
     */
    getSession(sessionId: string): BrowserSession | null;
    /**
     * Lists all active sessions.
     */
    listSessions(): BrowserSession[];
    /**
     * Navigates to a URL.
     *
     * @param sessionId - Session to use
     * @param context - Execution context
     * @param options - Navigation options
     */
    navigate(sessionId: string, context: BrowserExecutionContext, options: BrowserNavigationOptions): Promise<BrowserExecutionResult>;
    /**
     * Clicks an element.
     *
     * @param sessionId - Session to use
     * @param context - Execution context
     * @param options - Click options
     */
    click(sessionId: string, context: BrowserExecutionContext, options: BrowserClickOptions): Promise<BrowserExecutionResult>;
    /**
     * Types text into an input element.
     *
     * @param sessionId - Session to use
     * @param context - Execution context
     * @param options - Input options
     */
    input(sessionId: string, context: BrowserExecutionContext, options: BrowserInputOptions): Promise<BrowserExecutionResult>;
    /**
     * Takes a screenshot.
     *
     * @param sessionId - Session to use
     * @param context - Execution context
     * @param options - Screenshot options
     */
    screenshot(sessionId: string, context: BrowserExecutionContext, options?: BrowserScreenshotOptions): Promise<BrowserExecutionResult>;
    /**
     * Evaluates JavaScript in the browser context.
     *
     * @param sessionId - Session to use
     * @param context - Execution context
     * @param options - Evaluate options
     */
    evaluate(sessionId: string, context: BrowserExecutionContext, options: BrowserEvaluateOptions): Promise<BrowserExecutionResult>;
    /**
     * Waits for a selector to appear or reach a state.
     *
     * @param sessionId - Session to use
     * @param context - Execution context
     * @param options - Wait options
     */
    waitForSelector(sessionId: string, context: BrowserExecutionContext, options: BrowserWaitForSelectorOptions): Promise<BrowserExecutionResult>;
    /**
     * Gets an element's attribute value.
     *
     * @param sessionId - Session to use
     * @param context - Execution context
     * @param options - Get attribute options
     */
    getAttribute(sessionId: string, context: BrowserExecutionContext, options: BrowserGetAttributeOptions): Promise<BrowserExecutionResult>;
    /**
     * Scrolls an element or the page.
     *
     * @param sessionId - Session to use
     * @param context - Execution context
     * @param options - Scroll options
     */
    scroll(sessionId: string, context: BrowserExecutionContext, options: BrowserScrollOptions): Promise<BrowserExecutionResult>;
    /**
     * Gets the execution log for auditing.
     */
    getExecutionLog(): readonly BrowserExecutionResult[];
    /**
     * Clears the execution log.
     */
    clearExecutionLog(): void;
    private validateSession;
    private validateUrl;
    private validateSelector;
    private simulateOperation;
    private simulateEvaluate;
    private simulateGetAttribute;
    private buildResult;
    private buildErrorResult;
}
export declare function createBrowserExecutor(options?: BrowserExecutorOptions): BrowserExecutor;
export {};
