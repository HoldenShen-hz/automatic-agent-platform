/**
 * Markdown Runbook Parser
 *
 * Parses markdown-formatted runbooks into structured objects
 * that can be executed step by step.
 *
 * ## Supported Format
 *
 * ```markdown
 * # Title
 *
 * ## Section Name
 * 1. Step one
 * 2. Step two
 *
 * ## Another Section
 * - Non-sequential step
 * ```
 */
import type { ParsedRunbook, RunbookStep, RunbookStepResult } from "./types.js";
/**
 * Parses a markdown runbook into a structured ParsedRunbook object.
 */
export declare function parseRunbookMarkdown(markdown: string, runbookId?: string): ParsedRunbook;
/**
 * Creates an empty step result for tracking.
 */
export declare function createEmptyStepResult(step: RunbookStep): RunbookStepResult;
