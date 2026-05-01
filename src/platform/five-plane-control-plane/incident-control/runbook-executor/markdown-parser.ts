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

import { newId, nowIso } from "../../../../platform/contracts/types/ids.js";
import type {
  ParsedRunbook,
  RunbookSection,
  RunbookStep,
  RunbookStepResult,
  RunbookStepStatus,
} from "./types.js";

/**
 * Section names that are recognized as executable.
 */
const EXECUTABLE_SECTIONS = new Set([
  "diagnosis",
  "mitigation",
  "verification",
  "resolution",
  "remediation",
  "recovery",
]);

/**
 * Severity mapping from common title patterns.
 */
const SEVERITY_PATTERNS: Array<{ pattern: RegExp; severity: "P0" | "P1" | "P2" | "P3" }> = [
  { pattern: /\bP0\b|\bcritical\b|\b outage\b|\bdown\b/i, severity: "P0" },
  // R16-36 FIX #2119: "\bhight\b" is a typo - should be "\bhigh\b" for P1 matching.
  // Without this fix, "P1: High latency incident" would never match P1 severity.
  { pattern: /\bP1\b|\bhigh\b|\bspike\b/i, severity: "P1" },
  { pattern: /\bP2\b|\bdegraded\b|\bwarning\b/i, severity: "P2" },
  { pattern: /\bP3\b|\bminor\b|\binfo\b/i, severity: "P3" },
];

/**
 * Parses a markdown runbook into a structured ParsedRunbook object.
 */
export function parseRunbookMarkdown(
  markdown: string,
  runbookId?: string,
): ParsedRunbook {
  const lines = markdown.split("\n");
  const sections: RunbookSection[] = [];
  let currentSection: RunbookSection | null = null;
  let title = "Untitled Runbook";
  let severity: "P0" | "P1" | "P2" | "P3" = "P2";

  for (const line of lines) {
    const trimmed = line.trim();

    // Parse title (# Title)
    if (trimmed.startsWith("# ")) {
      title = trimmed.slice(2).trim();
      severity = detectSeverity(title);
      continue;
    }

    // Parse section headers (## Section Name)
    if (trimmed.startsWith("## ")) {
      if (currentSection) {
        sections.push(currentSection);
      }
      const sectionName = trimmed.slice(3).trim();
      currentSection = {
        name: sectionName,
        isExecutable: isExecutableSection(sectionName),
        steps: [],
      };
      continue;
    }

    // Parse steps in current section
    if (currentSection) {
      const step = parseStep(trimmed, currentSection.steps.length + 1);
      if (step) {
        currentSection.steps.push(step);
      }
    }
  }

  // Push the last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return {
    runbookId: runbookId ?? newId("runbook"),
    title,
    severity,
    sections,
    rawMarkdown: markdown,
    parsedAt: nowIso(),
  };
}

/**
 * Detects severity from runbook title.
 */
function detectSeverity(title: string): "P0" | "P1" | "P2" | "P3" {
  for (const { pattern, severity } of SEVERITY_PATTERNS) {
    if (pattern.test(title)) {
      return severity;
    }
  }
  return "P2";
}

/**
 * Checks if a section is executable.
 */
function isExecutableSection(sectionName: string): boolean {
  const lower = sectionName.toLowerCase();
  return EXECUTABLE_SECTIONS.has(lower);
}

/**
 * Parses a single step line.
 */
function parseStep(line: string, fallbackNumber: number): RunbookStep | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  // Match numbered steps: "1. Step text" or "1) Step text"
  const numberedMatch = trimmed.match(/^(\d+)[.)\s]+(.+)/);
  if (numberedMatch) {
    return {
      stepNumber: parseInt(numberedMatch[1]!, 10),
      command: numberedMatch[2]!.trim(),
      requiresConfirmation: false,
    };
  }

  // Match bullet points: "- Step text" or "* Step text"
  const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
  if (bulletMatch) {
    return {
      stepNumber: fallbackNumber,
      command: bulletMatch[1]!.trim(),
      requiresConfirmation: false,
    };
  }

  // Match checkboxes: "[ ] Step text" or "[x] Step text"
  const checkboxMatch = trimmed.match(/^\[[ x]\]\s*(.+)/i);
  if (checkboxMatch) {
    return {
      stepNumber: fallbackNumber,
      command: checkboxMatch[1]!.trim(),
      requiresConfirmation: false,
    };
  }

  // If line looks like a command (backticks), treat it as a step
  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return {
      stepNumber: fallbackNumber,
      command: trimmed.slice(1, -1).trim(),
      requiresConfirmation: true,
    };
  }

  // Lines that look like code/commands without backticks
  if (/^(npm |kubectl |docker |curl |git )/i.test(trimmed)) {
    return {
      stepNumber: fallbackNumber,
      command: trimmed,
      requiresConfirmation: true,
    };
  }

  return null;
}

/**
 * Creates an empty step result for tracking.
 */
export function createEmptyStepResult(step: RunbookStep): RunbookStepResult {
  return {
    step,
    status: "pending",
    command: step.command,
    output: "",
    startedAt: "",
    completedAt: "",
    durationMs: 0,
  };
}

