/**
 * Todo Write Tool
 *
 * Provides session-level todo list management with support for:
 * - Creating, updating, deleting, and listing todo items
 * - Status tracking: pending, in_progress, completed, cancelled
 * - Timeline and diagnostics integration
 *
 * This tool manages todo state within a session context.
 */
import type { ToolExecutionRequest } from "./tool-metadata.js";
export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";
export interface TodoItem {
    todoId: string;
    title: string;
    description: string | null;
    status: TodoStatus;
    priority: number | null;
    parentTodoId: string | null;
    progressPercent: number | null;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    sessionId: string | null;
}
export interface TodoWriteToolRequest extends ToolExecutionRequest {
    operation: "create" | "update" | "delete" | "list" | "get";
    sessionId?: string | null;
    todoId?: string | null;
    title?: string | null;
    description?: string | null;
    status?: TodoStatus | null;
    priority?: number | null;
    parentTodoId?: string | null;
    progressPercent?: number | null;
    filterStatus?: TodoStatus | null;
    filterSessionId?: string | null;
}
export interface TodoWriteToolResult {
    success: boolean;
    operation: "create" | "update" | "delete" | "list" | "get";
    todo: TodoItem | null;
    todos: readonly TodoItem[];
    durationMs: number;
    error: string | null;
    errorCode: string | null;
}
export interface TodoListFilters {
    status?: TodoStatus | null;
    sessionId?: string | null;
    parentTodoId?: string | null;
}
/**
 * Validates a todo item title
 */
export declare function validateTodoTitle(title: string | null | undefined): {
    valid: boolean;
    error?: string;
};
/**
 * Validates a todo ID format
 */
export declare function validateTodoId(todoId: string | null | undefined): {
    valid: boolean;
    error?: string;
};
/**
 * Validates progress percent value
 */
export declare function validateProgressPercent(value: number | null | undefined): {
    valid: boolean;
    error?: string;
};
/**
 * In-memory todo store for session-level todo management.
 * In production, this would be backed by persistent storage.
 */
export declare class TodoWriteToolService {
    private todos;
    constructor(initialTodos?: readonly TodoItem[]);
    /**
     * Generates a new todo ID
     */
    generateTodoId(): string;
    /**
     * Creates a new todo item
     */
    createTodo(request: TodoWriteToolRequest): TodoItem;
    /**
     * Updates an existing todo item
     */
    updateTodo(request: TodoWriteToolRequest): TodoItem;
    /**
     * Deletes a todo item
     */
    deleteTodo(request: TodoWriteToolRequest): void;
    /**
     * Gets a single todo by ID
     */
    getTodo(request: TodoWriteToolRequest): TodoItem | null;
    /**
     * Lists todos with optional filters
     */
    listTodos(request: TodoWriteToolRequest): readonly TodoItem[];
    /**
     * Computes completedAt based on status transition
     */
    private computeCompletedAt;
    /**
     * Gets todo statistics
     */
    getStats(): {
        total: number;
        pending: number;
        inProgress: number;
        completed: number;
        cancelled: number;
    };
}
/**
 * Executes a todo operation and returns the result
 */
export declare function executeTodoOperation(service: TodoWriteToolService, request: TodoWriteToolRequest): TodoWriteToolResult;
