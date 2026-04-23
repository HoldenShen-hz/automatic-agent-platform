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
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const toolArgumentCoercionLogger = new StructuredLogger({ retentionLimit: 100 });
// Valid enum values for question types
const QUESTION_TYPE_VALUES = ["single_choice", "multiple_choice", "skippable"];
// Valid operation types for todo operations
const TODO_OPERATION_VALUES = ["create", "update", "delete", "list", "get"];
/**
 * Returns the JavaScript type name of a value.
 */
function readType(value) {
    if (value === null)
        return "null";
    if (Array.isArray(value))
        return "array";
    return typeof value;
}
/**
 * Parses a string as a safe integer.
 * Returns null if the string is not a valid integer representation.
 */
function parseIntegerString(value) {
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
function coerceInteger(value, fieldPath) {
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
function coerceBoolean(value, fieldPath) {
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
function coercePrimitiveToString(value, fieldPath) {
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
function coerceStringEnum(value, allowed, fieldPath) {
    if (typeof value !== "string") {
        return { value };
    }
    const normalized = value.trim().toLowerCase();
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
function coerceJsonStringArray(value, fieldPath) {
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
    }
    catch (err) {
        toolArgumentCoercionLogger.debug("tool_argument_coercion: JSON parse failed in coerceJsonStringArray", { error: err instanceof Error ? err.message : String(err), fieldPath });
        return { value };
    }
}
/**
 * Parses a JSON string as an array of question options.
 * Each option must have optionId and label as strings.
 */
function coerceQuestionOptions(value, fieldPath) {
    const traces = [];
    if (typeof value !== "string") {
        return { value, traces };
    }
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
            return { value, traces };
        }
        const normalized = [];
        for (let index = 0; index < parsed.length; index += 1) {
            const item = parsed[index];
            if (item == null || typeof item !== "object" || Array.isArray(item)) {
                return { value, traces: [] };
            }
            const record = item;
            // Coerce each field of the option object
            const optionId = coercePrimitiveToString(record.optionId, `${fieldPath}[${index}].optionId`);
            const label = coercePrimitiveToString(record.label, `${fieldPath}[${index}].label`);
            const description = coercePrimitiveToString(record.description, `${fieldPath}[${index}].description`);
            const isDefault = coerceBoolean(record.isDefault, `${fieldPath}[${index}].isDefault`);
            if (optionId.trace)
                traces.push(optionId.trace);
            if (label.trace)
                traces.push(label.trace);
            if (description.trace)
                traces.push(description.trace);
            if (isDefault.trace)
                traces.push(isDefault.trace);
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
    }
    catch (err) {
        toolArgumentCoercionLogger.debug("tool_argument_coercion: JSON parse failed in coerceQuestionOptions", { error: err instanceof Error ? err.message : String(err), fieldPath });
        return { value, traces: [] };
    }
}
/**
 * Helper to apply a coercion result to an object field and record the trace.
 */
function applyTrace(nextValue, traces, field, result) {
    if (result.trace) {
        traces.push(result.trace);
    }
    nextValue[field] = result.value;
}
/**
 * Formats coercion traces as human-readable warning messages.
 */
export function formatToolArgumentCoercionWarnings(traces) {
    return traces.map((trace) => `tool.args_coerced:${trace.fieldPath}:${trace.strategy}`);
}
/**
 * Coerces arguments for the command execution tool.
 */
export function coerceCommandToolRequest(request) {
    const nextValue = { ...request };
    const traces = [];
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
export function coerceEditReplacementRequest(request) {
    const nextValue = { ...request };
    const traces = [];
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
export function coerceEditBatchRequest(request) {
    const nextValue = { ...request };
    const traces = [];
    applyTrace(nextValue, traces, "timeoutMs", coerceInteger(request.timeoutMs, "timeoutMs"));
    applyTrace(nextValue, traces, "lockTtlMs", coerceInteger(request.lockTtlMs, "lockTtlMs"));
    return { value: nextValue, traces };
}
/**
 * Coerces arguments for the patch tool.
 */
export function coercePatchToolRequest(request) {
    const nextValue = { ...request };
    const traces = [];
    applyTrace(nextValue, traces, "timeoutMs", coerceInteger(request.timeoutMs, "timeoutMs"));
    applyTrace(nextValue, traces, "strictMode", coerceBoolean(request.strictMode, "strictMode"));
    applyTrace(nextValue, traces, "allowCreation", coerceBoolean(request.allowCreation, "allowCreation"));
    return { value: nextValue, traces };
}
/**
 * Coerces arguments for the question tool.
 */
export function coerceQuestionToolRequest(request) {
    const nextValue = { ...request };
    const traces = [];
    applyTrace(nextValue, traces, "question", coercePrimitiveToString(request.question, "question"));
    applyTrace(nextValue, traces, "questionType", coerceStringEnum(request.questionType, QUESTION_TYPE_VALUES, "questionType"));
    applyTrace(nextValue, traces, "context", coercePrimitiveToString(request.context, "context"));
    applyTrace(nextValue, traces, "hint", coercePrimitiveToString(request.hint, "hint"));
    applyTrace(nextValue, traces, "required", coerceBoolean(request.required, "required"));
    applyTrace(nextValue, traces, "timeoutMs", coerceInteger(request.timeoutMs, "timeoutMs"));
    // Handle nested array of options
    const options = coerceQuestionOptions(request.options, "options");
    nextValue.options = options.value;
    traces.push(...options.traces);
    return { value: nextValue, traces };
}
/**
 * Coerces arguments for the todo write tool.
 */
export function coerceTodoWriteToolRequest(request) {
    const nextValue = { ...request };
    const traces = [];
    applyTrace(nextValue, traces, "operation", coerceStringEnum(request.operation, TODO_OPERATION_VALUES, "operation"));
    applyTrace(nextValue, traces, "status", coerceStringEnum(request.status, ["pending", "in_progress", "completed", "cancelled"], "status"));
    applyTrace(nextValue, traces, "filterStatus", coerceStringEnum(request.filterStatus, ["pending", "in_progress", "completed", "cancelled"], "filterStatus"));
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
export function coerceToolArguments(toolName, args) {
    switch (toolName) {
        case "command_exec":
        case "bash":
            return coerceCommandToolRequest(args);
        case "edit_replace":
            return coerceEditReplacementRequest(args);
        case "edit_batch":
            return coerceEditBatchRequest(args);
        case "apply_patch":
            return coercePatchToolRequest(args);
        case "question":
            return coerceQuestionToolRequest(args);
        case "todo_write":
            return coerceTodoWriteToolRequest(args);
        default:
            return { value: { ...args }, traces: [] };
    }
}
/**
 * Creates middleware that automatically coerces tool arguments before execution.
 */
export function createToolArgumentCoercionMiddleware() {
    return {
        name: "tool_argument_coercion",
        priority: 5,
        run: async (_ctx, input, next) => {
            const coerced = coerceToolArguments(input.toolName, input.args);
            const target = input.args;
            // Replace the arguments in place with coerced values
            for (const key of Object.keys(target)) {
                delete target[key];
            }
            Object.assign(target, coerced.value);
            return next();
        },
    };
}
//# sourceMappingURL=tool-argument-coercion.js.map