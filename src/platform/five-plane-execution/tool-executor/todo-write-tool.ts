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

import { newId } from "../../contracts/types/ids.js";
import { AppError, ValidationError } from "../../contracts/errors.js";
import type { ToolExecutionRequest } from "./tool-metadata.js";
import { coerceTodoWriteToolRequest } from "./tool-argument-coercion.js";

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
export function validateTodoTitle(title: string | null | undefined): { valid: boolean; error?: string } {
  if (title === null || title === undefined) {
    return { valid: true }; // Title is optional for update/delete
  }
  if (typeof title !== "string") {
    return { valid: false, error: "Title must be a string" };
  }
  if (title.trim().length === 0) {
    return { valid: false, error: "Title cannot be empty" };
  }
  if (title.length > 500) {
    return { valid: false, error: "Title cannot exceed 500 characters" };
  }
  return { valid: true };
}

/**
 * Validates a todo ID format
 */
export function validateTodoId(todoId: string | null | undefined): { valid: boolean; error?: string } {
  if (todoId === null || todoId === undefined) {
    return { valid: true }; // Optional for list/create
  }
  if (typeof todoId !== "string") {
    return { valid: false, error: "Todo ID must be a string" };
  }
  if (!todoId.startsWith("todo_")) {
    return { valid: false, error: "Invalid todo ID format" };
  }
  return { valid: true };
}

/**
 * Validates progress percent value
 */
export function validateProgressPercent(value: number | null | undefined): { valid: boolean; error?: string } {
  if (value === null || value === undefined) {
    return { valid: true };
  }
  if (typeof value !== "number") {
    return { valid: false, error: "Progress must be a number" };
  }
  if (value < 0 || value > 100) {
    return { valid: false, error: "Progress must be between 0 and 100" };
  }
  return { valid: true };
}

/**
 * In-memory todo store for session-level todo management.
 * In production, this would be backed by persistent storage.
 */
export class TodoWriteToolService {
  private todos: Map<string, TodoItem> = new Map();

  constructor(initialTodos?: readonly TodoItem[]) {
    if (initialTodos) {
      for (const todo of initialTodos) {
        this.todos.set(todo.todoId, { ...todo });
      }
    }
  }

  /**
   * Generates a new todo ID
   */
  generateTodoId(): string {
    return newId("todo");
  }

  /**
   * Creates a new todo item
   */
  createTodo(request: TodoWriteToolRequest): TodoItem {
    const normalizedRequest = coerceTodoWriteToolRequest(request).value;
    const titleValidation = validateTodoTitle(normalizedRequest.title);
    if (!titleValidation.valid) {
      throw new ValidationError("todo.invalid_title", `Invalid title: ${titleValidation.error}`, {
        source: "tool",
        details: { title: normalizedRequest.title ?? null },
      });
    }

    const todoId = normalizedRequest.todoId ?? this.generateTodoId();
    const now = new Date().toISOString();

    const todo: TodoItem = {
      todoId,
      title: normalizedRequest.title?.trim() ?? "Untitled",
      description: normalizedRequest.description ?? null,
      status: normalizedRequest.status ?? "pending",
      priority: normalizedRequest.priority ?? null,
      parentTodoId: normalizedRequest.parentTodoId ?? null,
      progressPercent: normalizedRequest.progressPercent ?? null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      sessionId: normalizedRequest.filterSessionId ?? normalizedRequest.sessionId ?? null,
    };

    this.todos.set(todoId, todo);
    return { ...todo };
  }

  /**
   * Updates an existing todo item
   */
  updateTodo(request: TodoWriteToolRequest): TodoItem {
    const normalizedRequest = coerceTodoWriteToolRequest(request).value;

    if (!normalizedRequest.todoId) {
      throw new ValidationError("todo.todo_id_required", "Todo ID is required for update operation", {
        source: "tool",
        details: { operation: "update" },
      });
    }

    const existing = this.todos.get(normalizedRequest.todoId);
    if (!existing) {
      throw new ValidationError("todo.not_found", "Todo not found.", {
        source: "tool",
        details: { todoId: normalizedRequest.todoId },
      });
    }

    const titleValidation = validateTodoTitle(normalizedRequest.title);
    if (!titleValidation.valid) {
      throw new ValidationError("todo.invalid_title", `Invalid title: ${titleValidation.error}`, {
        source: "tool",
        details: { title: normalizedRequest.title ?? null, todoId: normalizedRequest.todoId },
      });
    }

    const progressValidation = validateProgressPercent(normalizedRequest.progressPercent);
    if (!progressValidation.valid) {
      throw new ValidationError("todo.invalid_progress", `Invalid progress: ${progressValidation.error}`, {
        source: "tool",
        details: {
          progressPercent: normalizedRequest.progressPercent ?? null,
          todoId: normalizedRequest.todoId,
        },
      });
    }

    const now = new Date().toISOString();
    const updated: TodoItem = {
      ...existing,
      title: normalizedRequest.title?.trim() ?? existing.title,
      description: normalizedRequest.description !== undefined ? normalizedRequest.description : existing.description,
      status: normalizedRequest.status ?? existing.status,
      priority: normalizedRequest.priority !== undefined ? (normalizedRequest.priority ?? null) : existing.priority,
      parentTodoId: normalizedRequest.parentTodoId !== undefined ? (normalizedRequest.parentTodoId ?? null) : existing.parentTodoId,
      progressPercent: normalizedRequest.progressPercent !== undefined ? (normalizedRequest.progressPercent ?? null) : existing.progressPercent,
      updatedAt: now,
      completedAt: this.computeCompletedAt(existing.status, normalizedRequest.status, now),
    };

    this.todos.set(updated.todoId, updated);
    return { ...updated };
  }

  /**
   * Deletes a todo item
   */
  deleteTodo(request: TodoWriteToolRequest): void {
    const normalizedRequest = coerceTodoWriteToolRequest(request).value;
    if (!normalizedRequest.todoId) {
      throw new ValidationError("todo.todo_id_required", "Todo ID is required for delete operation", {
        source: "tool",
        details: { operation: "delete" },
      });
    }

    if (!this.todos.has(normalizedRequest.todoId)) {
      throw new ValidationError("todo.not_found", "Todo not found.", {
        source: "tool",
        details: { todoId: normalizedRequest.todoId },
      });
    }

    this.todos.delete(normalizedRequest.todoId);
  }

  /**
   * Gets a single todo by ID
   */
  getTodo(request: TodoWriteToolRequest): TodoItem | null {
    const normalizedRequest = coerceTodoWriteToolRequest(request).value;
    if (!normalizedRequest.todoId) {
      throw new ValidationError("todo.todo_id_required", "Todo ID is required for get operation", {
        source: "tool",
        details: { operation: "get" },
      });
    }

    return this.todos.get(normalizedRequest.todoId) ?? null;
  }

  /**
   * Lists todos with optional filters
   */
  listTodos(request: TodoWriteToolRequest): readonly TodoItem[] {
    const normalizedRequest = coerceTodoWriteToolRequest(request).value;
    let todos = Array.from(this.todos.values());

    if (normalizedRequest.filterStatus) {
      todos = todos.filter(t => t.status === normalizedRequest.filterStatus);
    }

    if (normalizedRequest.filterSessionId) {
      todos = todos.filter(t => t.sessionId === normalizedRequest.filterSessionId);
    }

    if (normalizedRequest.parentTodoId !== undefined) {
      if (normalizedRequest.parentTodoId === null) {
        todos = todos.filter(t => t.parentTodoId === null);
      } else {
        todos = todos.filter(t => t.parentTodoId === normalizedRequest.parentTodoId);
      }
    }

    return todos.reverse();
  }

  /**
   * Computes completedAt based on status transition
   */
  private computeCompletedAt(
    oldStatus: TodoStatus,
    newStatus: TodoStatus | null | undefined,
    now: string,
  ): string | null {
    if (newStatus === "completed" && oldStatus !== "completed") {
      return now;
    }
    if (newStatus === "cancelled" && oldStatus !== "cancelled") {
      return now;
    }
    return null;
  }

  /**
   * Gets todo statistics
   */
  getStats(): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
  } {
    const todos = Array.from(this.todos.values());
    return {
      total: todos.length,
      pending: todos.filter(t => t.status === "pending").length,
      inProgress: todos.filter(t => t.status === "in_progress").length,
      completed: todos.filter(t => t.status === "completed").length,
      cancelled: todos.filter(t => t.status === "cancelled").length,
    };
  }
}

/**
 * Executes a todo operation and returns the result
 */
export function executeTodoOperation(
  service: TodoWriteToolService,
  request: TodoWriteToolRequest,
): TodoWriteToolResult {
  const startTime = Date.now();

  try {
    let todo: TodoItem | null = null;
    let todos: readonly TodoItem[] = [];

    switch (request.operation) {
      case "create":
        todo = service.createTodo(request);
        todos = [];
        break;

      case "update":
        todo = service.updateTodo(request);
        todos = [];
        break;

      case "delete":
        service.deleteTodo(request);
        todo = null;
        todos = [];
        break;

      case "get":
        todo = service.getTodo(request);
        todos = [];
        break;

      case "list":
        todo = null;
        todos = service.listTodos(request);
        break;
    }

    return {
      success: true,
      operation: request.operation,
      todo,
      todos,
      durationMs: Date.now() - startTime,
      error: null,
      errorCode: null,
    };
  } catch (err) {
    const errorCode = err instanceof AppError
      ? err.code
      : err instanceof Error && err.message.includes("not found")
        ? "todo.not_found"
        : "todo.operation_failed";
    return {
      success: false,
      operation: request.operation,
      todo: null,
      todos: [],
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
      errorCode,
    };
  }
}
