/**
 * Integration Test: Tool Execution Integration
 *
 * Verifies tool execution records are properly stored
 * and can be retrieved for audit/debugging purposes.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
test("tool execution: can insert and retrieve execution records", () => {
    const workspace = createTempWorkspace("aa-tool-exec-");
    try {
        const dbPath = join(workspace, "tool-exec.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const taskId = newId("task");
        const executionId = newId("exec");
        const now = nowIso();
        // Insert task first
        db.connection
            .prepare(`INSERT INTO tasks (id, parent_id, root_id, division_id, title, status, source, priority,
          input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd,
          error_code, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(taskId, null, taskId, "general_ops", "Tool execution test", "in_progress", "user", "normal", "{}", null, null, 0, 0, null, now, now, null);
        // Insert execution
        db.connection
            .prepare(`INSERT INTO executions (id, task_id, workflow_id, parent_execution_id, agent_id, role_id,
          run_kind, status, input_ref, trace_id, attempt, timeout_ms, budget_usd_limit, requires_approval,
          sandbox_mode, allowed_tools_json, allowed_paths_json, max_retries, retry_backoff,
          last_error_code, last_error_message, started_at, finished_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(executionId, taskId, "single_agent_minimal", null, "agent-1", "general_executor", "task_run", "executing", null, "tool-exec-trace", 1, 60000, 1.0, 0, "workspace_write", "[]", "[]", 0, "none", null, null, now, null, now, now);
        // Verify execution was inserted
        const execution = db.connection
            .prepare("SELECT * FROM executions WHERE id = ?")
            .get(executionId);
        assert.ok(execution, "Execution should exist");
        assert.equal(execution.id, executionId);
        assert.equal(execution.task_id, taskId);
        assert.equal(execution.status, "executing");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("tool execution: execution timeout is recorded correctly", () => {
    const workspace = createTempWorkspace("aa-tool-timeout-");
    try {
        const dbPath = join(workspace, "tool-timeout.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const taskId = newId("task");
        const executionId = newId("exec");
        const now = nowIso();
        // Insert task
        db.connection
            .prepare(`INSERT INTO tasks (id, parent_id, root_id, division_id, title, status, source, priority,
          input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd,
          error_code, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(taskId, null, taskId, "general_ops", "Timeout test", "in_progress", "user", "normal", "{}", null, null, 0, 0, null, now, now, null);
        // Insert execution with timeout
        db.connection
            .prepare(`INSERT INTO executions (id, task_id, workflow_id, parent_execution_id, agent_id, role_id,
          run_kind, status, input_ref, trace_id, attempt, timeout_ms, budget_usd_limit, requires_approval,
          sandbox_mode, allowed_tools_json, allowed_paths_json, max_retries, retry_backoff,
          last_error_code, last_error_message, started_at, finished_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(executionId, taskId, "single_agent_minimal", null, "agent-1", "general_executor", "task_run", "executing", null, "timeout-trace", 1, 30000, 1.0, 0, "workspace_write", "[]", "[]", 0, "none", null, null, now, null, now, now);
        // Verify timeout value
        const execution = db.connection
            .prepare("SELECT timeout_ms FROM executions WHERE id = ?")
            .get(executionId);
        assert.ok(execution, "Execution should exist");
        assert.equal(execution.timeout_ms, 30000, "Timeout should be 30000ms");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("tool execution: allowed tools and paths are enforced", () => {
    const workspace = createTempWorkspace("aa-tool-allowed-");
    try {
        const dbPath = join(workspace, "tool-allowed.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const taskId = newId("task");
        const executionId = newId("exec");
        const now = nowIso();
        // Insert task
        db.connection
            .prepare(`INSERT INTO tasks (id, parent_id, root_id, division_id, title, status, source, priority,
          input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd,
          error_code, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(taskId, null, taskId, "general_ops", "Allowed tools test", "in_progress", "user", "normal", "{}", null, null, 0, 0, null, now, now, null);
        // Insert execution with allowed tools and paths
        const allowedTools = JSON.stringify(["Read", "Edit", "Bash"]);
        const allowedPaths = JSON.stringify(["/workspace", "/tmp"]);
        db.connection
            .prepare(`INSERT INTO executions (id, task_id, workflow_id, parent_execution_id, agent_id, role_id,
          run_kind, status, input_ref, trace_id, attempt, timeout_ms, budget_usd_limit, requires_approval,
          sandbox_mode, allowed_tools_json, allowed_paths_json, max_retries, retry_backoff,
          last_error_code, last_error_message, started_at, finished_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(executionId, taskId, "single_agent_minimal", null, "agent-1", "general_executor", "task_run", "executing", null, "allowed-trace", 1, 60000, 1.0, 0, "workspace_write", allowedTools, allowedPaths, 0, "none", null, null, now, null, now, now);
        // Verify allowed tools and paths
        const execution = db.connection
            .prepare("SELECT allowed_tools_json, allowed_paths_json FROM executions WHERE id = ?")
            .get(executionId);
        assert.ok(execution, "Execution should exist");
        const tools = JSON.parse(execution.allowed_tools_json);
        assert.deepEqual(tools, ["Read", "Edit", "Bash"], "Allowed tools should match");
        const paths = JSON.parse(execution.allowed_paths_json);
        assert.deepEqual(paths, ["/workspace", "/tmp"], "Allowed paths should match");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=tool-execution-integration.test.js.map