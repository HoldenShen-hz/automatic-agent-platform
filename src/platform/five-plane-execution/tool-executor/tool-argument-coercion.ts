/**
 * Tool Argument Coercion
 *
 * Provides automatic type coercion for tool arguments to handle cases where
 * LLM-generated arguments may be strings that should be interpreted as other types.
 *
 * Supported coercions:
 * - String to integer (for timeout, TTL values)
 * - String to boolean (for flags like strictMode, allowCreation)
 * - JSON string to string array (for path lists)
 * - JSON string to object array (for structured options like question options)
 * - Primitive to string (numbers to string for text fields)
 * - String enum normalization (lowercase normalization for enum values)
 *
 * This enables robust tool calling even when the LLM provides arguments
 * in a format that differs slightly from the schema.
 */

import type { WrapToolCallHook } from "../execution-engine/agent-middleware-chain.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

import { CommandToolRequest, PatchToolRequest } from "./tool-metadata.js";
import type { EditBatchRequest, EditReplacementRequest } from "./edit-replacement-service.js";
import type { QuestionOption, QuestionToolRequest } from "./question-tool.js";
import type { TodoWriteToolRequest } from "./todo-write-tool.js";

const toolArgumentCoercionLogger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Strategy used to coerce an argument from one type to another.
 */
export type ToolArgumentCoercionStrategy =
  | "string_to_integer"
  | "string_to_boolean"
  | "json_string_to_string_array"
  | "json_string_to_object_array"
  | "primitive_to_string"
  | "normalized_enum";

/**
 * Record of a single coercion transformation applied to an argument.
 */
export interface ToolArgumentCoercionTrace {
  /** Dot-separated path to the coerced field (e.g., "timeoutMs", "options[0].label") */
  fieldPath: string;

  /** The coercion strategy that was applied */
  strategy: ToolArgumentCoercionStrategy;

  /** Original type of the value */
  fromType: string;

  /** Target type after coercion */
  toType: string;
}

/**
 * Result of coercing a tool's arguments.
 */
export interface ToolArgumentCoercionResult<T> {
  /** The coerced arguments */
  value: T;

  /** All coercions that were applied during processing */
  traces: ToolArgumentCoercionTrace[];
}

// Valid enum values for question types
const QUESTION_TYPE_VALUES = ["single_choice", "multiple_choice", "skippable"] as const;

// Valid operation types for todo operations
const TODO_OPERATION_VALUES = ["create", "update", "delete", "list", "get"] as const;

/**
 * Returns the JavaScript type name of a value.
 */
function readType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Parses a string as a safe integer.
 * Returns null if the string is not a valid integer representation.
 */
function parseIntegerString(value: string): number | null {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Coerces a string value to integer if possible.
 */
function coerceInteger(
  value: unknown,
  fieldPath: string,
): { value: unknown; trace?: ToolArgumentCoercionTrace } {
  if (typeof value !== "string") {
    return { value };
  }
  const parsed = parseIntegerString(value);
  if (parsed == null) {
    return { value };
  }
  return {
    value: parsed,
    trace: {
      fieldPath,
      strategy: "string_to_integer",
      fromType: "string",
      toType: "number",
    },
  };
}

/**
 * Coerces a string value to boolean.
 * Accepts "true"/"1" as true and "false"/"0" as false (case-insensitive).
 */
function coerceBoolean(
  value: unknown,
  fieldPath: string,
): { value: unknown; trace?: ToolArgumentCoercionTrace } {
  if (typeof value !== "string") {
    return { value };
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "true" || trimmed === "1") {
    return {
      value: true,
      trace: {
        fieldPath,
        strategy: "string_to_boolean",
        fromType: "string",
        toType: "boolean",
      },
    };
  }
  if (trimmed === "false" || trimmed === "0") {
    return {
      value: false,
      trace: {
        fieldPath,
        strategy: "string_to_boolean",
        fromType: "string",
        toType: "boolean",
      },
    };
  }
  return { value };
}

/**
 * Coerces a primitive (number, boolean) to string.
 * No-op for strings and null.
 */
function coercePrimitiveToString(
  value: unknown,
  fieldPath: string,
): { value: unknown; trace?: ToolArgumentCoercionTrace } {
  if (typeof value === "string" || value == null) {
    return { value };
  }
  if (typeof value !== "number" && typeof value !== "boolean") {
    return { value };
  }
  return {
    value: String(value),
    trace: {
      fieldPath,
      strategy: "primitive_to_string",
      fromType: readType(value),
      toType: "string",
    },
  };
}

/**
 * Normalizes a string enum value to lowercase if it matches an allowed value.
 */
function coerceStringEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldPath: string,
): { value: unknown; trace?: ToolArgumentCoercionTrace } {
  if (typeof value !== "string") {
    return { value };
  }
  const normalized = value.trim().toLowerCase() as T;
  if (!allowed.includes(normalized)) {
    return { value };
  }
  // Only trace if value actually changed
  if (normalized === value) {
    return { value };
  }
  return {
    value: normalized,
    trace: {
      fieldPath,
      strategy: "normalized_enum",
      fromType: "string",
      toType: "string",
    },
  };
}

/**
 * Parses a JSON string as a string array.
 */
function coerceJsonStringArray(
  value: unknown,
  fieldPath: string,
): { value: unknown; trace?: ToolArgumentCoercionTrace } {
  if (typeof value !== "string") {
    return { value };
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
      return { value };
    }
    return {
      value: parsed,
      trace: {
        fieldPath,
        strategy: "json_string_to_string_array",
        fromType: "string",
        toType: "array",
      },
    };
  } catch (err) {
    toolArgumentCoercionLogger.debug("tool_argument_coercion: JSON parse failed in coerceJsonStringArray", { error: err instanceof Error ? err.message : String(err), fieldPath });
    return { value };
  }
}

/**
 * Parses a JSON string as an array of question options.
 * Each option must have optionId and label as strings.
 */
function coerceQuestionOptions(
  value: unknown,
  fieldPath: string,
): { value: unknown; traces: ToolArgumentCoercionTrace[] } {
  const traces: ToolArgumentCoercionTrace[] = [];
  if (typeof value !== "string") {
    return { value, traces };
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return { value, traces };
    }

    const normalized: QuestionOption[] = [];
    for (let index = 0; index < parsed.length; index += 1) {
      const item = parsed[index];
      if (item == null || typeof item !== "object" || Array.isArray(item)) {
        return { value, traces: [] };
      }
      const record = item as Record<string, unknown>;

      // Coerce each field of the option object
      const optionId = coercePrimitiveToString(record.optionId, `${fieldPath}[${index}].optionId`);
      const label = coercePrimitiveToString(record.label, `${fieldPath}[${index}].label`);
      const description = coercePrimitiveToString(record.description, `${fieldPath}[${index}].description`);
      const isDefault = coerceBoolean(record.isDefault, `${fieldPath}[${index}].isDefault`);

      if (optionId.trace) traces.push(optionId.trace);
      if (label.trace) traces.push(label.trace);
      if (description.trace) traces.push(description.trace);
      if (isDefault.trace) traces.push(isDefault.trace);

      // Validate required fields
      if (typeof optionId.value !== "string" || typeof label.value !== "string") {
        return { value, traces: [] };
      }

      normalized.push({
        optionId: optionId.value,
        label: label.value,
        ...(description.value != null ? { description: String(description.value) } : {}),
        ...(typeof isDefault.value === "boolean" ? { isDefault: isDefault.value } : {}),
      });
    }

    traces.unshift({
      fieldPath,
      strategy: "json_string_to_object_array",
      fromType: "string",
      toType: "array",
    });
    return { value: normalized, traces };
  } catch (err) {
    toolArgumentCoercionLogger.debug("tool_argument_coercion: JSON parse failed in coerceQuestionOptions", { error: err instanceof Error ? err.message : String(err), fieldPath });
    return { value, traces: [] };
  }
}

/**
 * Helper to apply a coercion result to an object field and record the trace.
 */
function applyTrace<T extends object>(
  nextValue: T,
  traces: ToolArgumentCoercionTrace[],
  field: keyof T,
  result: { value: unknown; trace?: ToolArgumentCoercionTrace },
): void {
  if (result.trace) {
    traces.push(result.trace);
  }
  (nextValue as Record<PropertyKey, unknown>)[field] = result.value as T[keyof T];
}

/**
 * Formats coercion traces as human-readable warning messages.
 */
export function formatToolArgumentCoercionWarnings(traces: readonly ToolArgumentCoercionTrace[]): string[] {
  return traces.map((trace) => `tool.args_coerced:${trace.fieldPath}:${trace.strategy}`);
}

export interface LegacyToolArgumentCoercionInput {
  readonly request: {
    readonly args?: unknown;
  };
  readonly traceId?: string;
}

export interface LegacyToolArgumentCoercionDecision {
  readonly denied: boolean;
  readonly diagnostic: {
    readonly code: string;
    readonly message: string;
  };
}

export class ToolArgumentCoercion {
  public static coerce(input: LegacyToolArgumentCoercionInput): LegacyToolArgumentCoercionDecision {
    const args = input.request.args;
    if (!Array.isArray(args)) {
      return {
        denied: true,
        diagnostic: {
          code: "tool.args_invalid_type",
          message: `Command args must be an array, received ${readType(args)}.`,
        },
      };
    }
    if (Object.getPrototypeOf(args) !== Array.prototype) {
      return {
        denied: true,
        diagnostic: {
          code: "tool.args_invalid_array",
          message: "Command args must be a plain array.",
        },
      };
    }
    const invalidIndex = args.findIndex((arg) => typeof arg !== "string");
    if (invalidIndex >= 0) {
      return {
        denied: true,
        diagnostic: {
          code: "tool.args_invalid_element",
          message: `Command arg ${invalidIndex} must be string, received ${readType(args[invalidIndex])}.`,
        },
      };
    }
    return {
      denied: false,
      diagnostic: {
        code: "tool.args_valid",
        message: "Command args are valid.",
      },
    };
  }
}

/**
 * Coerces arguments for the command execution tool.
 */
export function coerceCommandToolRequest(request: CommandToolRequest): ToolArgumentCoercionResult<CommandToolRequest> {
  const nextValue: CommandToolRequest = { ...request };
  const traces: ToolArgumentCoercionTrace[] = [];

  applyTrace(nextValue, traces, "timeoutMs", coerceInteger(request.timeoutMs, "timeoutMs"));
  applyTrace(nextValue, traces, "args", coerceJsonStringArray(request.args, "args"));
  applyTrace(nextValue, traces, "allowedPathRoots", coerceJsonStringArray(request.allowedPathRoots, "allowedPathRoots"));
  applyTrace(nextValue, traces, "declaredReadPaths", coerceJsonStringArray(request.declaredReadPaths, "declaredReadPaths"));
  applyTrace(nextValue, traces, "declaredWritePaths", coerceJsonStringArray(request.declaredWritePaths, "declaredWritePaths"));

  return { value: nextValue, traces };
}

/**
 * Coerces arguments for the edit replacement tool.
 */
export function coerceEditReplacementRequest(
  request: EditReplacementRequest,
): ToolArgumentCoercionResult<EditReplacementRequest> {
  const nextValue: EditReplacementRequest = { ...request };
  const traces: ToolArgumentCoercionTrace[] = [];

  applyTrace(nextValue, traces, "timeoutMs", coerceInteger(request.timeoutMs, "timeoutMs"));
  applyTrace(nextValue, traces, "lockTtlMs", coerceInteger(request.lockTtlMs, "lockTtlMs"));
  applyTrace(nextValue, traces, "oldString", coercePrimitiveToString(request.oldString, "oldString"));
  applyTrace(nextValue, traces, "newString", coercePrimitiveToString(request.newString, "newString"));
  applyTrace(nextValue, traces, "beforeAnchor", coercePrimitiveToString(request.beforeAnchor, "beforeAnchor"));
  applyTrace(nextValue, traces, "afterAnchor", coercePrimitiveToString(request.afterAnchor, "afterAnchor"));

  return { value: nextValue, traces };
}

/**
 * Coerces arguments for the batch edit tool.
 */
export function coerceEditBatchRequest(request: EditBatchRequest): ToolArgumentCoercionResult<EditBatchRequest> {
  const nextValue: EditBatchRequest = { ...request };
  const traces: ToolArgumentCoercionTrace[] = [];

  applyTrace(nextValue, traces, "timeoutMs", coerceInteger(request.timeoutMs, "timeoutMs"));
  applyTrace(nextValue, traces, "lockTtlMs", coerceInteger(request.lockTtlMs, "lockTtlMs"));

  return { value: nextValue, traces };
}

/**
 * Coerces arguments for the patch tool.
 */
export function coercePatchToolRequest(request: PatchToolRequest): ToolArgumentCoercionResult<PatchToolRequest> {
  const nextValue: PatchToolRequest = { ...request };
  const traces: ToolArgumentCoercionTrace[] = [];

  applyTrace(nextValue, traces, "timeoutMs", coerceInteger(request.timeoutMs, "timeoutMs"));
  applyTrace(nextValue, traces, "strictMode", coerceBoolean(request.strictMode, "strictMode"));
  applyTrace(nextValue, traces, "allowCreation", coerceBoolean(request.allowCreation, "allowCreation"));

  return { value: nextValue, traces };
}

/**
 * Coerces arguments for the question tool.
 */
export function coerceQuestionToolRequest(request: QuestionToolRequest): ToolArgumentCoercionResult<QuestionToolRequest> {
  const nextValue: QuestionToolRequest = { ...request };
  const traces: ToolArgumentCoercionTrace[] = [];

  applyTrace(nextValue, traces, "question", coercePrimitiveToString(request.question, "question"));
  applyTrace(nextValue, traces, "questionType", coerceStringEnum(request.questionType, QUESTION_TYPE_VALUES, "questionType"));
  applyTrace(nextValue, traces, "context", coercePrimitiveToString(request.context, "context"));
  applyTrace(nextValue, traces, "hint", coercePrimitiveToString(request.hint, "hint"));
  applyTrace(nextValue, traces, "required", coerceBoolean(request.required, "required"));
  applyTrace(nextValue, traces, "timeoutMs", coerceInteger(request.timeoutMs, "timeoutMs"));

  // Handle nested array of options
  const options = coerceQuestionOptions(request.options, "options");
  nextValue.options = options.value as QuestionToolRequest["options"];
  traces.push(...options.traces);

  return { value: nextValue, traces };
}

/**
 * Coerces arguments for the todo write tool.
 */
export function coerceTodoWriteToolRequest(request: TodoWriteToolRequest): ToolArgumentCoercionResult<TodoWriteToolRequest> {
  const nextValue: TodoWriteToolRequest = { ...request };
  const traces: ToolArgumentCoercionTrace[] = [];

  applyTrace(nextValue, traces, "operation", coerceStringEnum(request.operation, TODO_OPERATION_VALUES, "operation"));
  applyTrace(nextValue, traces, "status", coerceStringEnum(request.status, ["pending", "in_progress", "completed", "cancelled"] as const, "status"));
  applyTrace(nextValue, traces, "filterStatus", coerceStringEnum(request.filterStatus, ["pending", "in_progress", "completed", "cancelled"] as const, "filterStatus"));
  applyTrace(nextValue, traces, "todoId", coercePrimitiveToString(request.todoId, "todoId"));
  applyTrace(nextValue, traces, "sessionId", coercePrimitiveToString(request.sessionId, "sessionId"));
  applyTrace(nextValue, traces, "filterSessionId", coercePrimitiveToString(request.filterSessionId, "filterSessionId"));
  applyTrace(nextValue, traces, "parentTodoId", coercePrimitiveToString(request.parentTodoId, "parentTodoId"));
  applyTrace(nextValue, traces, "title", coercePrimitiveToString(request.title, "title"));
  applyTrace(nextValue, traces, "description", coercePrimitiveToString(request.description, "description"));
  applyTrace(nextValue, traces, "priority", coerceInteger(request.priority, "priority"));
  applyTrace(nextValue, traces, "progressPercent", coerceInteger(request.progressPercent, "progressPercent"));

  return { value: nextValue, traces };
}

/**
 * Dispatches argument coercion to the appropriate tool-specific handler.
 */
export function coerceToolArguments(
  toolName: string,
  args: Record<string, unknown>,
): ToolArgumentCoercionResult<Record<string, unknown>> {
  switch (toolName) {
    case "command_exec":
    case "bash":
      return coerceCommandToolRequest(args as unknown as CommandToolRequest) as unknown as ToolArgumentCoercionResult<Record<string, unknown>>;
    case "edit_replace":
      return coerceEditReplacementRequest(args as unknown as EditReplacementRequest) as unknown as ToolArgumentCoercionResult<Record<string, unknown>>;
    case "edit_batch":
      return coerceEditBatchRequest(args as unknown as EditBatchRequest) as unknown as ToolArgumentCoercionResult<Record<string, unknown>>;
    case "apply_patch":
      return coercePatchToolRequest(args as unknown as PatchToolRequest) as unknown as ToolArgumentCoercionResult<Record<string, unknown>>;
    case "question":
      return coerceQuestionToolRequest(args as unknown as QuestionToolRequest) as unknown as ToolArgumentCoercionResult<Record<string, unknown>>;
    case "todo_write":
      return coerceTodoWriteToolRequest(args as unknown as TodoWriteToolRequest) as unknown as ToolArgumentCoercionResult<Record<string, unknown>>;
    default:
      return { value: { ...args }, traces: [] };
  }
}

/**
 * Creates middleware that automatically coerces tool arguments before execution.
 */
export function createToolArgumentCoercionMiddleware(): WrapToolCallHook {
  return {
    name: "tool_argument_coercion",
    priority: 5,
    run: async (_ctx, input, next) => {
      const coerced = coerceToolArguments(input.toolName, input.args);
      input.args = { ...coerced.value };
      return next();
    },
  };
}
