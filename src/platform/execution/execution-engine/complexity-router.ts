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
 * @see {@link docs_zh/automatic_agent_patform_arthitecture_design.md}
 */

import { nowIso } from "../../contracts/types/ids.js";

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

const DEFAULT_FULL_KEYWORDS = [
  "refactor", "redesign", "migrate", "architecture", "security audit",
  "performance analysis", "comprehensive", "all files", "entire codebase",
  "deep analysis", "root cause", "investigation",
];

const DEFAULT_FAST_KEYWORDS = [
  "what is", "show me", "list", "find", "grep", "search",
  "quick", "simple", "brief", "lookup", "check",
];

const DEFAULT_CONFIG: Required<ComplexityRouterConfig> = {
  fullPathKeywords: DEFAULT_FULL_KEYWORDS,
  fastPathKeywords: DEFAULT_FAST_KEYWORDS,
  passthroughMaxChars: 50,
  qaModeForceFull: true,
};

export function routeComplexity(
  taskTitle: string,
  options?: {
    stepCount?: number;
    qaMode?: boolean;
    estimatedTokens?: number;
    config?: ComplexityRouterConfig;
  },
): ComplexityRouteResult {
  const config = { ...DEFAULT_CONFIG, ...options?.config };
  const title = taskTitle.toLowerCase();

  // QA mode always routes to full
  if (options?.qaMode && config.qaModeForceFull) {
    return {
      path: "full",
      reason: "qa_mode_active",
      estimatedBudgetFactor: 2.0,
      routedAt: nowIso(),
    };
  }

  // Multi-step workflows get at least standard
  if ((options?.stepCount ?? 0) > 3) {
    // Check for full-path keywords in multi-step
    for (const keyword of config.fullPathKeywords) {
      if (title.includes(keyword.toLowerCase())) {
        return {
          path: "full",
          reason: `keyword_match:${keyword}`,
          estimatedBudgetFactor: 2.0,
          routedAt: nowIso(),
        };
      }
    }
    return {
      path: "standard",
      reason: "multi_step_workflow",
      estimatedBudgetFactor: 1.0,
      routedAt: nowIso(),
    };
  }

  // Very short input → passthrough
  if (taskTitle.length <= config.passthroughMaxChars && !options?.stepCount) {
    return {
      path: "passthrough",
      reason: "short_input",
      estimatedBudgetFactor: 0.1,
      routedAt: nowIso(),
    };
  }

  // High token estimate → full
  if ((options?.estimatedTokens ?? 0) > 50000) {
    return {
      path: "full",
      reason: "high_token_estimate",
      estimatedBudgetFactor: 2.0,
      routedAt: nowIso(),
    };
  }

  // Check full-path keywords
  for (const keyword of config.fullPathKeywords) {
    if (title.includes(keyword.toLowerCase())) {
      return {
        path: "full",
        reason: `keyword_match:${keyword}`,
        estimatedBudgetFactor: 2.0,
        routedAt: nowIso(),
      };
    }
  }

  // Check fast-path keywords
  for (const keyword of config.fastPathKeywords) {
    if (title.includes(keyword.toLowerCase())) {
      return {
        path: "fast",
        reason: `keyword_match:${keyword}`,
        estimatedBudgetFactor: 0.3,
        routedAt: nowIso(),
      };
    }
  }

  // Default: standard
  return {
    path: "standard",
    reason: "default",
    estimatedBudgetFactor: 1.0,
    routedAt: nowIso(),
  };
}
