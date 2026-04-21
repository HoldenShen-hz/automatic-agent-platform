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
import { CommandToolRequest, PatchToolRequest } from "./tool-metadata.js";
import type { EditBatchRequest, EditReplacementRequest } from "./edit-replacement-service.js";
import type { QuestionToolRequest } from "./question-tool.js";
import type { TodoWriteToolRequest } from "./todo-write-tool.js";
/**
 * Strategy used to coerce an argument from one type to another.
 */
export type ToolArgumentCoercionStrategy = "string_to_integer" | "string_to_boolean" | "json_string_to_string_array" | "json_string_to_object_array" | "primitive_to_string" | "normalized_enum";
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
/**
 * Formats coercion traces as human-readable warning messages.
 */
export declare function formatToolArgumentCoercionWarnings(traces: readonly ToolArgumentCoercionTrace[]): string[];
/**
 * Coerces arguments for the command execution tool.
 */
export declare function coerceCommandToolRequest(request: CommandToolRequest): ToolArgumentCoercionResult<CommandToolRequest>;
/**
 * Coerces arguments for the edit replacement tool.
 */
export declare function coerceEditReplacementRequest(request: EditReplacementRequest): ToolArgumentCoercionResult<EditReplacementRequest>;
/**
 * Coerces arguments for the batch edit tool.
 */
export declare function coerceEditBatchRequest(request: EditBatchRequest): ToolArgumentCoercionResult<EditBatchRequest>;
/**
 * Coerces arguments for the patch tool.
 */
export declare function coercePatchToolRequest(request: PatchToolRequest): ToolArgumentCoercionResult<PatchToolRequest>;
/**
 * Coerces arguments for the question tool.
 */
export declare function coerceQuestionToolRequest(request: QuestionToolRequest): ToolArgumentCoercionResult<QuestionToolRequest>;
/**
 * Coerces arguments for the todo write tool.
 */
export declare function coerceTodoWriteToolRequest(request: TodoWriteToolRequest): ToolArgumentCoercionResult<TodoWriteToolRequest>;
/**
 * Dispatches argument coercion to the appropriate tool-specific handler.
 */
export declare function coerceToolArguments(toolName: string, args: Record<string, unknown>): ToolArgumentCoercionResult<Record<string, unknown>>;
/**
 * Creates middleware that automatically coerces tool arguments before execution.
 */
export declare function createToolArgumentCoercionMiddleware(): WrapToolCallHook;
