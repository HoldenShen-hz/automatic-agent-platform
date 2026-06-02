import { readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, normalize, resolve } from "node:path";

import { ValidationError } from "../../platform/contracts/errors.js";

const DEFAULT_MAX_BYTES = 512 * 1024;

function resolveWorkspaceFile(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("cli.file_path_required", "A file path is required.");
  }
  if (trimmed.includes("\u0000")) {
    throw new ValidationError("cli.file_invalid_path", "File path contains unsupported characters.");
  }
  if (!isAbsolute(trimmed)) {
    const normalized = normalize(trimmed);
    if (normalized.startsWith("..")) {
      throw new ValidationError("cli.file_path_traversal", `Refusing to traverse outside cwd: ${trimmed}`);
    }
  }
  return resolve(trimmed);
}

export function readGuardedJsonFile(path: string, label: string, maxBytes = DEFAULT_MAX_BYTES): string {
  const resolved = resolveWorkspaceFile(path);
  if (extname(resolved).toLowerCase() !== ".json") {
    throw new ValidationError("cli.file_invalid_extension", `${label} must be a .json file.`);
  }
  const stats = statSync(resolved);
  if (!stats.isFile()) {
    throw new ValidationError("cli.file_not_regular", `${label} must be a regular file.`);
  }
  if (!Number.isFinite(stats.size) || stats.size <= 0 || stats.size > maxBytes) {
    throw new ValidationError(
      "cli.file_size_out_of_range",
      `${label} must be between 1 and ${maxBytes} bytes.`,
    );
  }
  return readFileSync(resolved, "utf8");
}

export function readGuardedTextFile(path: string, label: string, maxBytes = DEFAULT_MAX_BYTES): string {
  const resolved = resolveWorkspaceFile(path);
  const stats = statSync(resolved);
  if (!stats.isFile()) {
    throw new ValidationError("cli.file_not_regular", `${label} must be a regular file.`);
  }
  if (!Number.isFinite(stats.size) || stats.size <= 0 || stats.size > maxBytes) {
    throw new ValidationError(
      "cli.file_size_out_of_range",
      `${label} must be between 1 and ${maxBytes} bytes.`,
    );
  }
  return readFileSync(resolved, "utf8");
}

export function summarizeCliError(error: unknown, fallbackCode: string): string {
  if (error instanceof ValidationError) {
    return error.code;
  }
  if (error instanceof SyntaxError) {
    return `${fallbackCode}.invalid_json`;
  }
  if (error instanceof Error) {
    return fallbackCode;
  }
  return fallbackCode;
}
