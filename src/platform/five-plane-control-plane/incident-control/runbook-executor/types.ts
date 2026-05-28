/**
 * Runbook Executor Types
 *
 * Defines types for parsing, executing, and auditing markdown runbooks.
 *
 * ## Runbook Format
 *
 * Markdown runbooks have the following structure:
 * ```markdown
 * # Runbook Title
 *
 * ## Symptoms
 * - symptom description
 *
 * ## Diagnosis
 * 1. First diagnostic step
 * 2. Second diagnostic step
 *
 * ## Mitigation
 * 1. First mitigation action
 * 2. Second mitigation action
 *
 * ## Verification
 * 1. First verification check
 * 2. Second verification check
 * ```
 */

import type { RunbookSeverity } from "../operations-governance-service.js";

/**
 * A step in a runbook section.
 */
export interface RunbookStep {
  /** Step number within the section */
  stepNumber: number;
  /** The command or action to execute */
  command: string;
  /** Whether this step requires confirmation before execution */
  requiresConfirmation: boolean;
}

/**
 * A section within a runbook (e.g., Diagnosis, Mitigation).
 */
export interface RunbookSection {
  /** Section name */
  name: string;
  /** Whether this section contains executable steps */
  isExecutable: boolean;
  /** Steps in this section */
  steps: RunbookStep[];
}

/**
 * A parsed runbook document.
 */
export interface ParsedRunbook {
  /** Unique identifier */
  runbookId: string;
  /** Human-readable title */
  title: string;
  /** Severity level */
  severity: RunbookSeverity;
  /** All sections found in the runbook */
  sections: RunbookSection[];
  /** Raw markdown content */
  rawMarkdown: string;
  /** When this runbook was parsed */
  parsedAt: string;
}

/**
 * Status of a runbook step execution.
 */
export type RunbookStepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "requires_confirmation";

/**
 * Result of executing a single step.
 */
export interface RunbookStepResult {
  /** Step that was executed */
  step: RunbookStep;
  /** Execution status */
  status: RunbookStepStatus;
  /** Command that was executed */
  command: string;
  /** Output from the command (stdout/stderr) */
  output: string;
  /** Error message if failed */
  errorMessage?: string;
  /** When execution started */
  startedAt: string;
  /** When execution completed */
  completedAt: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Whether the step requires human confirmation to proceed */
  waitingForConfirmation?: boolean;
}

/**
 * Status of an entire runbook execution.
 */
export type RunbookExecutionStatus = "initialized" | "running" | "paused" | "completed" | "failed" | "aborted";

/**
 * Result of executing a complete runbook.
 */
export interface RunbookExecutionResult {
  /** Unique execution ID */
  executionId: string;
  /** The runbook that was executed */
  runbook: ParsedRunbook;
  /** Current execution status */
  status: RunbookExecutionStatus;
  /** Results for each section */
  sectionResults: RunbookSectionExecutionResult[];
  /** Overall outcome */
  outcome: "success" | "partial" | "failed" | "aborted";
  /** Summary of what happened */
  summary: string;
  /** When execution started */
  startedAt: string;
  /** When execution completed */
  completedAt: string | null;
  /** Total duration in milliseconds */
  totalDurationMs: number | null;
  /** Actor who executed (user or system) */
  executedBy: string;
}

/**
 * Result of executing a runbook section.
 */
export interface RunbookSectionExecutionResult {
  /** Section name */
  sectionName: string;
  /** Execution status */
  status: RunbookExecutionStatus;
  /** Step results */
  stepResults: RunbookStepResult[];
  /** Number of completed steps */
  completedSteps: number;
  /** Number of failed steps */
  failedSteps: number;
  /** Number of skipped steps */
  skippedSteps: number;
}

/**
 * Configuration for runbook execution.
 */
export interface RunbookExecutorConfig {
  /** Whether to auto-execute or require manual step confirmation */
  autoExecute: boolean;
  /** Timeout for each step in milliseconds */
  stepTimeoutMs: number;
  /** Whether to continue on step failure */
  continueOnFailure: boolean;
  /** Whether to execute verification steps */
  executeVerification: boolean;
  /** Optional injection seam for controlled command execution. */
  commandRunner?: (command: string, timeoutMs: number) => Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;
}

/**
 * Context for runbook execution.
 */
export interface RunbookExecutionContext {
  /** Task ID related to this incident */
  taskId?: string;
  /** Incident ID being addressed */
  incidentId?: string;
  /** Execution environment */
  environment?: string;
  /** Additional variables for template substitution */
  variables?: Record<string, string>;
}

/**
 * Default runbook executor configuration.
 */
export const DEFAULT_RUNBOOK_EXECUTOR_CONFIG: RunbookExecutorConfig = {
  autoExecute: false,
  stepTimeoutMs: 300_000, // 5 minutes
  continueOnFailure: false,
  executeVerification: true,
};
