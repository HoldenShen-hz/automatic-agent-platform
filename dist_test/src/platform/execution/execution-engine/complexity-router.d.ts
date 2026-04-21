/**
 * Complexity Router
 *
 * Routes incoming tasks through one of four complexity paths based on task
 * characteristics such as keyword matching, estimated token usage, QA mode,
 * and budget allocation.
 *
 * Paths:
 * - **passthrough**: Trivial tasks (single tool call, no reasoning needed)
 * - **fast**: Simple tasks (brief answers, lookups, quick edits)
 * - **standard**: Normal multi-step tasks (most tasks)
 * - **full**: Complex tasks (multi-file refactors, architecture analysis, QA mode)
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md}
 */
export type ComplexityPath = "passthrough" | "fast" | "standard" | "full";
export interface ComplexityRouteResult {
    path: ComplexityPath;
    reason: string;
    estimatedBudgetFactor: number;
    routedAt: string;
}
export interface ComplexityRouterConfig {
    /** Keywords that push a task to the "full" path */
    fullPathKeywords?: readonly string[];
    /** Keywords that push a task to the "fast" path */
    fastPathKeywords?: readonly string[];
    /** Max input length (chars) for passthrough */
    passthroughMaxChars?: number;
    /** Whether QA mode forces full path */
    qaModeForceFull?: boolean;
}
export declare function routeComplexity(taskTitle: string, options?: {
    stepCount?: number;
    qaMode?: boolean;
    estimatedTokens?: number;
    config?: ComplexityRouterConfig;
}): ComplexityRouteResult;
