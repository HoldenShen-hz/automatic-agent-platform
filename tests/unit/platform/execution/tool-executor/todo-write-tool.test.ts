import assert from "node:assert/strict";
import test from "node:test";

import { createWorkspaceWritePolicy } from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";
import {
  TodoWriteToolService,
  validateTodoTitle,
  validateTodoId,
  validateProgressPercent,
  executeTodoOperation,
  type TodoWriteToolRequest,
  type TodoStatus,
} from "../../../../../src/platform/execution/tool-executor/todo-write-tool.js";

function createMockRequest(overrides: Partial<TodoWriteToolRequest> = {}): TodoWriteToolRequest {
  return {
    callId: "call-1",
    taskId: "task-1",
    executionId: null,
    traceId: "trace-1",
    toolName: "todo_write",
    operation: "create",
    todoId: null,
    title: "Test todo",
    sandboxPolicy: createWorkspaceWritePolicy(process.cwd()),
    agentId: "agent-1",
    ...overrides,
  };
}

test("validateTodoTitle accepts valid title", () => {
  assert.equal(validateTodoTitle("Buy groceries").valid, true);
  assert.equal(validateTodoTitle("Task with special chars: @#$%").valid, true);
  assert.equal(validateTodoTitle("Multi-word task description").valid, true);
});

test("validateTodoTitle accepts null/undefined for optional", () => {
  assert.equal(validateTodoTitle(null).valid, true);
  assert.equal(validateTodoTitle(undefined).valid, true);
});

test("validateTodoTitle rejects empty string", () => {
  const result = validateTodoTitle("");
  assert.equal(result.valid, false);
  assert.ok(result.error?.includes("empty"));
});

test("validateTodoTitle rejects whitespace-only string", () => {
  const result = validateTodoTitle("   ");
  assert.equal(result.valid, false);
});

test("validateTodoTitle rejects title over 500 characters", () => {
  const longTitle = "a".repeat(501);
  const result = validateTodoTitle(longTitle);
  assert.equal(result.valid, false);
  assert.ok(result.error?.includes("500"));
});

test("validateTodoId accepts valid format", () => {
  assert.equal(validateTodoId("todo_123").valid, true);
  assert.equal(validateTodoId("todo_abc123xyz").valid, true);
});

test("validateTodoId accepts null/undefined for optional", () => {
  assert.equal(validateTodoId(null).valid, true);
  assert.equal(validateTodoId(undefined).valid, true);
});

test("validateTodoId rejects invalid format", () => {
  assert.equal(validateTodoId("task_123").valid, false);
  assert.equal(validateTodoId("todo").valid, false);
  assert.equal(validateTodoId("").valid, false);
});

test("validateProgressPercent accepts valid values", () => {
  assert.equal(validateProgressPercent(null).valid, true);
  assert.equal(validateProgressPercent(undefined).valid, true);
  assert.equal(validateProgressPercent(0).valid, true);
  assert.equal(validateProgressPercent(50).valid, true);
  assert.equal(validateProgressPercent(100).valid, true);
});

test("validateProgressPercent rejects invalid values", () => {
  assert.equal(validateProgressPercent(-1).valid, false);
  assert.equal(validateProgressPercent(101).valid, false);
  assert.equal(validateProgressPercent(150).valid, false);
});

test("TodoWriteToolService.createTodo creates todo with defaults", () => {
  const service = new TodoWriteToolService();
  const request = createMockRequest({ operation: "create" });

  const todo = service.createTodo(request);

  assert.ok(todo.todoId.startsWith("todo_"));
  assert.equal(todo.title, "Test todo");
  assert.equal(todo.status, "pending");
  assert.equal(todo.description, null);
  assert.equal(todo.priority, null);
  assert.equal(todo.parentTodoId, null);
  assert.equal(todo.progressPercent, null);
  assert.ok(todo.createdAt);
  assert.ok(todo.updatedAt);
  assert.equal(todo.completedAt, null);
});

test("TodoWriteToolService.createTodo creates todo with all fields", () => {
  const service = new TodoWriteToolService();
  const request = createMockRequest({
    operation: "create",
    title: "Full todo",
    description: "A description",
    status: "in_progress",
    priority: 5,
    parentTodoId: "todo_parent",
    progressPercent: 30,
  });

  const todo = service.createTodo(request);

  assert.equal(todo.title, "Full todo");
  assert.equal(todo.description, "A description");
  assert.equal(todo.status, "in_progress");
  assert.equal(todo.priority, 5);
  assert.equal(todo.parentTodoId, "todo_parent");
  assert.equal(todo.progressPercent, 30);
});

test("TodoWriteToolService.updateTodo updates existing todo", () => {
  const service = new TodoWriteToolService();
  const createRequest = createMockRequest({ operation: "create", title: "Original" });
  const created = service.createTodo(createRequest);

  const updateRequest = createMockRequest({
    operation: "update",
    todoId: created.todoId,
    title: "Updated",
    status: "completed",
  });
  const updated = service.updateTodo(updateRequest);

  assert.equal(updated.todoId, created.todoId);
  assert.equal(updated.title, "Updated");
  assert.equal(updated.status, "completed");
  assert.ok(updated.updatedAt >= created.updatedAt);
});

test("TodoWriteToolService.updateTodo throws for non-existent todo", () => {
  const service = new TodoWriteToolService();
  const request = createMockRequest({
    operation: "update",
    todoId: "todo_nonexistent",
    title: "Updated",
  });

  assert.throws(() => service.updateTodo(request), /not found/);
});

test("TodoWriteToolService.deleteTodo removes todo", () => {
  const service = new TodoWriteToolService();
  const created = service.createTodo(createMockRequest({ operation: "create" }));

  service.deleteTodo({ todoId: created.todoId } as TodoWriteToolRequest);

  assert.equal(service.getTodo({ todoId: created.todoId } as TodoWriteToolRequest), null);
});

test("TodoWriteToolService.deleteTodo throws for non-existent todo", () => {
  const service = new TodoWriteToolService();

  assert.throws(
    () => service.deleteTodo({ todoId: "todo_nonexistent" } as TodoWriteToolRequest),
    /not found/,
  );
});

test("TodoWriteToolService.getTodo returns todo", () => {
  const service = new TodoWriteToolService();
  const created = service.createTodo(createMockRequest({ operation: "create" }));

  const retrieved = service.getTodo({ todoId: created.todoId } as TodoWriteToolRequest);

  assert.equal(retrieved?.todoId, created.todoId);
  assert.equal(retrieved?.title, created.title);
});

test("TodoWriteToolService.getTodo returns null for non-existent", () => {
  const service = new TodoWriteToolService();

  const result = service.getTodo({ todoId: "todo_nonexistent" } as TodoWriteToolRequest);

  assert.equal(result, null);
});

test("TodoWriteToolService.listTodos returns all todos", () => {
  const service = new TodoWriteToolService();
  service.createTodo(createMockRequest({ title: "Todo 1" }));
  service.createTodo(createMockRequest({ title: "Todo 2" }));
  service.createTodo(createMockRequest({ title: "Todo 3" }));

  const todos = service.listTodos({ operation: "list" } as TodoWriteToolRequest);

  assert.equal(todos.length, 3);
});

test("TodoWriteToolService.listTodos filters by status", () => {
  const service = new TodoWriteToolService();
  service.createTodo(createMockRequest({ title: "Pending 1", status: "pending" }));
  service.createTodo(createMockRequest({ title: "Pending 2", status: "pending" }));
  service.createTodo(createMockRequest({ title: "In Progress", status: "in_progress" }));
  service.createTodo(createMockRequest({ title: "Completed", status: "completed" }));

  const todos = service.listTodos({
    operation: "list",
    filterStatus: "pending",
  } as TodoWriteToolRequest);

  assert.equal(todos.length, 2);
  assert.ok(todos.every(t => t.status === "pending"));
});

test("TodoWriteToolService.listTodos filters by sessionId", () => {
  const service = new TodoWriteToolService();
  service.createTodo(createMockRequest({ title: "Session 1", filterSessionId: "session_a" }));
  service.createTodo(createMockRequest({ title: "Session 2", filterSessionId: "session_a" }));
  service.createTodo(createMockRequest({ title: "Session 3", filterSessionId: "session_b" }));

  const todos = service.listTodos({
    operation: "list",
    filterSessionId: "session_a",
  } as TodoWriteToolRequest);

  assert.equal(todos.length, 2);
});

test("TodoWriteToolService.listTodos sorts by createdAt descending", () => {
  const service = new TodoWriteToolService();
  const t1 = service.createTodo(createMockRequest({ title: "First" }));
  const t2 = service.createTodo(createMockRequest({ title: "Second" }));
  const t3 = service.createTodo(createMockRequest({ title: "Third" }));

  const todos = service.listTodos({ operation: "list" } as TodoWriteToolRequest);

  assert.equal(todos[0]!.title, "Third");
  assert.equal(todos[1]!.title, "Second");
  assert.equal(todos[2]!.title, "First");
});

test("TodoWriteToolService.getStats returns correct counts", () => {
  const service = new TodoWriteToolService();
  service.createTodo(createMockRequest({ status: "pending" }));
  service.createTodo(createMockRequest({ status: "pending" }));
  service.createTodo(createMockRequest({ status: "in_progress" }));
  service.createTodo(createMockRequest({ status: "completed" }));
  service.createTodo(createMockRequest({ status: "cancelled" }));

  const stats = service.getStats();

  assert.equal(stats.total, 5);
  assert.equal(stats.pending, 2);
  assert.equal(stats.inProgress, 1);
  assert.equal(stats.completed, 1);
  assert.equal(stats.cancelled, 1);
});

test("executeTodoOperation create returns success", () => {
  const service = new TodoWriteToolService();
  const request = createMockRequest({ operation: "create" });

  const result = executeTodoOperation(service, request);

  assert.equal(result.success, true);
  assert.equal(result.operation, "create");
  assert.ok(result.todo);
  assert.equal(result.todos.length, 0);
  assert.equal(result.error, null);
  assert.equal(result.errorCode, null);
});

test("executeTodoOperation list returns todos", () => {
  const service = new TodoWriteToolService();
  service.createTodo(createMockRequest({ title: "Test" }));
  const request = createMockRequest({ operation: "list" });

  const result = executeTodoOperation(service, request);

  assert.equal(result.success, true);
  assert.equal(result.operation, "list");
  assert.equal(result.todo, null);
  assert.equal(result.todos.length, 1);
});

test("executeTodoOperation update returns success", () => {
  const service = new TodoWriteToolService();
  const created = service.createTodo(createMockRequest({ operation: "create" }));
  const request = createMockRequest({
    operation: "update",
    todoId: created.todoId,
    status: "completed",
  });

  const result = executeTodoOperation(service, request);

  assert.equal(result.success, true);
  assert.equal(result.operation, "update");
  assert.equal(result.todo?.status, "completed");
});

test("executeTodoOperation delete returns success", () => {
  const service = new TodoWriteToolService();
  const created = service.createTodo(createMockRequest({ operation: "create" }));
  const request = createMockRequest({
    operation: "delete",
    todoId: created.todoId,
  });

  const result = executeTodoOperation(service, request);

  assert.equal(result.success, true);
  assert.equal(result.operation, "delete");
  assert.equal(result.todo, null);
});

test("executeTodoOperation get returns success", () => {
  const service = new TodoWriteToolService();
  const created = service.createTodo(createMockRequest({ operation: "create" }));
  const request = createMockRequest({
    operation: "get",
    todoId: created.todoId,
  });

  const result = executeTodoOperation(service, request);

  assert.equal(result.success, true);
  assert.equal(result.operation, "get");
  assert.equal(result.todo?.todoId, created.todoId);
});

test("executeTodoOperation sets completedAt when status becomes completed", () => {
  const service = new TodoWriteToolService();
  const created = service.createTodo(createMockRequest({ operation: "create" }));
  const request = createMockRequest({
    operation: "update",
    todoId: created.todoId,
    status: "completed",
  });

  const result = executeTodoOperation(service, request);

  assert.equal(result.success, true);
  assert.equal(result.todo?.completedAt !== null, true);
});
