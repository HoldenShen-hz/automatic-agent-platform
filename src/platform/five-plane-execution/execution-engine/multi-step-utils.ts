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
  return value.flatMap((item) => {
    if (Array.isArray(item)) {
      return parseOptionalStringArray(item);
    }
    if (typeof item !== "string") {
      return [];
    }
    const normalized = item.trim();
    return normalized.length > 0 ? [normalized] : [];
  });
}

export function resolveMultiStepToolPath(rootPath: string, inputPath: string | null | undefined): string {
  const normalizedRoot = resolve(rootPath);
  const rawInputPath = inputPath ?? ".";
  const decodedInputPath = decodeURIComponent(rawInputPath);
  const pathSegments = decodedInputPath.split(/[\\/]+/u).filter((segment) => segment.length > 0);
  if (pathSegments.includes("..")) {
    throw new ToolExecutionError(
      `tool.path_outside_workspace:${rawInputPath}`,
      `tool.path_outside_workspace:${rawInputPath}`,
    );
  }

  const resolved = resolve(normalizedRoot, rawInputPath);
  const rootIsFilesystemRoot = normalizedRoot === sep;

  if (!rootIsFilesystemRoot && resolved !== normalizedRoot && !resolved.startsWith(`${normalizedRoot}${sep}`)) {
    throw new ToolExecutionError(
      `tool.path_outside_workspace:${rawInputPath}`,
      `tool.path_outside_workspace:${rawInputPath}`,
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
