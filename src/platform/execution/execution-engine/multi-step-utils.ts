/**
 * @fileoverview Multi-Step Utility Functions
 *
 * Helper functions for multi-step orchestration.
 */

import { resolve, sep } from "node:path";
import { ToolExecutionError } from "../../contracts/errors.js";

export function parseOptionalPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.trunc(value);
}

export function parseOptionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function resolveMultiStepToolPath(rootPath: string, inputPath: string | null | undefined): string {
  const resolved = resolve(rootPath, inputPath ?? ".");
  if (resolved !== rootPath && !resolved.startsWith(`${rootPath}${sep}`)) {
    throw new ToolExecutionError(
      `tool.path_outside_workspace:${inputPath ?? "."}`,
      `tool.path_outside_workspace:${inputPath ?? "."}`,
    );
  }
  return resolved;
}

export function safeParseToolResult(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}
