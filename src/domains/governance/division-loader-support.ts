import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SandboxError, ValidationError, WorkflowStateError } from "../../platform/contracts/errors.js";

export function throwDivisionValidationError(code: string, details: Record<string, unknown> = {}): never {
  throw new ValidationError(code, code, {
    retryable: false,
    details,
  });
}

export function throwDivisionWorkflowError(code: string, details: Record<string, unknown> = {}): never {
  throw new WorkflowStateError(code, code, {
    retryable: false,
    details,
  });
}

export function throwDivisionSandboxError(code: string, details: Record<string, unknown> = {}): never {
  throw new SandboxError(code, code, {
    retryable: false,
    details,
  });
}

export interface ParsedLine {
  indent: number;
  text: string;
  lineNumber: number;
}

export interface RawDivisionRoleConfig {
  id: string;
  name?: string;
  prompt: string;
  model?: string;
  tools?: unknown;
  max_instances?: unknown;
}

export interface RawDivisionConfig {
  id: string;
  version?: unknown;
  name: string;
  description?: unknown;
  priority?: unknown;
  default_workflow: string;
  orchestration_workflow?: unknown;
  triggers?: unknown;
  roles?: unknown;
  // §37: DomainDescriptor structured hierarchy
  domain_descriptor?: unknown;
  risk_profile?: unknown;
  eval_spec?: unknown;
}

export interface RawWorkflowStepConfig {
  step_id: string;
  division_id?: unknown;
  role_id: string;
  input_keys?: unknown;
  output_key: string;
  output_schema?: unknown;
  timeout_ms: unknown;
  max_attempts: unknown;
  depends_on?: unknown;
}

export interface RawWorkflowConfig {
  id: string;
  division_id: string;
  steps: unknown;
}

function resolveDefaultDivisionsRoot(): string {
  const startDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(process.cwd(), "divisions"),
    join(process.cwd(), "..", "divisions"),
    join(startDir, "../../divisions"),
    join(startDir, "../../../divisions"),
    join(startDir, "../../../../divisions"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!;
}

export const DEFAULT_DIVISIONS_ROOT = resolveDefaultDivisionsRoot();

export function tokenizeYaml(raw: string): ParsedLine[] {
  return raw
    .split(/\r?\n/)
    .map((line, index) => ({ rawLine: line, lineNumber: index + 1 }))
    .filter(({ rawLine }) => rawLine.trim().length > 0 && !rawLine.trimStart().startsWith("#"))
    .map(({ rawLine, lineNumber }) => ({
      indent: rawLine.match(/^ */)?.[0].length ?? 0,
      text: rawLine.trim(),
      lineNumber,
    }));
}

export function parseLimitedYaml(raw: string, sourcePath: string): unknown {
  const lines = tokenizeYaml(raw);
  if (lines.length === 0) return {};
  const [value, nextIndex] = parseBlock(lines, 0, lines[0]!.indent, sourcePath);
  if (nextIndex !== lines.length) {
    throwDivisionValidationError("yaml.trailing_content", {
      sourcePath,
      lineNumber: lines[nextIndex]!.lineNumber,
    });
  }
  return value;
}

export function parseBlock(lines: ParsedLine[], startIndex: number, indent: number, sourcePath: string): [unknown, number] {
  const line = lines[startIndex];
  if (!line || line.indent < indent) return [{}, startIndex];
  if (line.indent !== indent) {
    throwDivisionValidationError("yaml.invalid_indent", { sourcePath, lineNumber: line.lineNumber });
  }
  return line.text.startsWith("- ")
    ? parseArray(lines, startIndex, indent, sourcePath)
    : parseObject(lines, startIndex, indent, sourcePath);
}

export function parseObject(
  lines: ParsedLine[],
  startIndex: number,
  indent: number,
  sourcePath: string,
): [Record<string, unknown>, number] {
  const result: Record<string, unknown> = {};
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    if (!line) break;
    if (line.indent < indent) break;
    if (line.indent > indent) {
      throwDivisionValidationError("yaml.invalid_indent", { sourcePath, lineNumber: line.lineNumber });
    }
    if (line.text.startsWith("- ")) break;
    const [key, inlineValue] = splitKeyValue(line.text, sourcePath, line.lineNumber);
    index += 1;
    if (inlineValue.length > 0) {
      result[key] = parseScalar(inlineValue);
      continue;
    }
    if (index < lines.length && (lines[index]?.indent ?? -1) > indent) {
      const [nestedValue, nextIndex] = parseBlock(lines, index, indent + 2, sourcePath);
      result[key] = nestedValue;
      index = nextIndex;
      continue;
    }
    result[key] = null;
  }
  return [result, index];
}

export function parseArray(
  lines: ParsedLine[],
  startIndex: number,
  indent: number,
  sourcePath: string,
): [unknown[], number] {
  const result: unknown[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    if (!line) break;
    if (line.indent < indent) break;
    if (line.indent > indent) {
      throwDivisionValidationError("yaml.invalid_indent", { sourcePath, lineNumber: line.lineNumber });
    }
    if (!line.text.startsWith("- ")) break;
    const itemText = line.text.slice(2).trim();
    index += 1;
    if (itemText.length === 0) {
      if (index >= lines.length || (lines[index]?.indent ?? -1) <= indent) {
        result.push(null);
        continue;
      }
      const [nestedValue, nextIndex] = parseBlock(lines, index, indent + 2, sourcePath);
      result.push(nestedValue);
      index = nextIndex;
      continue;
    }
    if (looksLikeKeyValue(itemText)) {
      const [key, inlineValue] = splitKeyValue(itemText, sourcePath, line.lineNumber);
      const objectValue: Record<string, unknown> = { [key]: inlineValue.length > 0 ? parseScalar(inlineValue) : null };
      if (index < lines.length && (lines[index]?.indent ?? -1) > indent) {
        const [nestedValue, nextIndex] = parseObject(lines, index, indent + 2, sourcePath);
        Object.assign(objectValue, nestedValue);
        index = nextIndex;
      }
      result.push(objectValue);
      continue;
    }
    result.push(parseScalar(itemText));
  }
  return [result, index];
}

export function splitKeyValue(text: string, sourcePath: string, lineNumber: number): [string, string] {
  const separatorIndex = text.indexOf(":");
  if (separatorIndex <= 0) {
    throwDivisionValidationError("yaml.invalid_mapping", { sourcePath, lineNumber });
  }
  const key = text.slice(0, separatorIndex).trim();
  const value = text.slice(separatorIndex + 1).trim();
  if (key.length === 0) {
    throwDivisionValidationError("yaml.invalid_mapping", { sourcePath, lineNumber });
  }
  return [key, value];
}

export function looksLikeKeyValue(text: string): boolean {
  return text.includes(":");
}

export function parseScalar(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (inner.length === 0) return [];
    return inner.split(",").map((item) => parseScalar(item.trim()));
  }
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if ((raw.startsWith("\"") && raw.endsWith("\"")) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function expectNonEmptyString(value: unknown, errorCode: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(errorCode, errorCode, { retryable: false });
  }
  return value.trim();
}

export function toObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Record<string, unknown> => isPlainObject(entry));
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function toInteger<T>(value: unknown, fallback: T): number | T {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return fallback;
}
