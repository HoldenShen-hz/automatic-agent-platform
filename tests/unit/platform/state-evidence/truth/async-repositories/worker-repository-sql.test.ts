import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKER_SNAPSHOT_SELECT,
  AGENT_EXECUTION_SELECT,
  AGENT_EXECUTION_SELECT_SCOPED,
  REMOTE_LOG_SELECT,
  REMOTE_LOG_SELECT_SCOPED,
} from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/worker-repository-sql.js";

// ─────────────────────────────────────────────────────────────────────────────
// Worker Snapshot Select
// ─────────────────────────────────────────────────────────────────────────────

test("WORKER_SNAPSHOT_SELECT contains required columns", () => {
  assert.ok(WORKER_SNAPSHOT_SELECT.includes("worker_id"));
  assert.ok(WORKER_SNAPSHOT_SELECT.includes("status"));
  assert.ok(WORKER_SNAPSHOT_SELECT.includes("saturation"));
  assert.ok(WORKER_SNAPSHOT_SELECT.includes("active_lease_count"));
  assert.ok(WORKER_SNAPSHOT_SELECT.includes("last_heartbeat_at"));
  assert.ok(WORKER_SNAPSHOT_SELECT.includes("updated_at"));
});

test("WORKER_SNAPSHOT_SELECT maps snake_case to camelCase", () => {
  assert.ok(WORKER_SNAPSHOT_SELECT.includes('worker_id AS "workerId"'));
  assert.ok(WORKER_SNAPSHOT_SELECT.includes('saturation'));
  assert.ok(WORKER_SNAPSHOT_SELECT.includes('updated_at AS "updatedAt"'));
});

test("WORKER_SNAPSHOT_SELECT includes performance metrics", () => {
  assert.ok(WORKER_SNAPSHOT_SELECT.includes("mean_startup_latency_ms"));
  assert.ok(WORKER_SNAPSHOT_SELECT.includes("sandbox_success_rate"));
  assert.ok(WORKER_SNAPSHOT_SELECT.includes("repo_cache_hit_rate"));
});

test("WORKER_SNAPSHOT_SELECT includes remote session info", () => {
  assert.ok(WORKER_SNAPSHOT_SELECT.includes("remote_session_status"));
  assert.ok(WORKER_SNAPSHOT_SELECT.includes("stream_resume_success_rate"));
  assert.ok(WORKER_SNAPSHOT_SELECT.includes("credential_refresh_success_rate"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Agent Execution Select
// ─────────────────────────────────────────────────────────────────────────────

test("AGENT_EXECUTION_SELECT contains required columns", () => {
  assert.ok(AGENT_EXECUTION_SELECT.includes("execution_id"));
  assert.ok(AGENT_EXECUTION_SELECT.includes("task_id"));
  assert.ok(AGENT_EXECUTION_SELECT.includes("agent_id"));
  assert.ok(AGENT_EXECUTION_SELECT.includes("status"));
  assert.ok(AGENT_EXECUTION_SELECT.includes("created_at"));
});

test("AGENT_EXECUTION_SELECT maps snake_case to camelCase", () => {
  assert.ok(AGENT_EXECUTION_SELECT.includes('task_id AS "taskId"'));
  assert.ok(AGENT_EXECUTION_SELECT.includes('agent_id AS "agentId"'));
  assert.ok(AGENT_EXECUTION_SELECT.includes('created_at AS "createdAt"'));
});

test("AGENT_EXECUTION_SELECT includes execution tracking fields", () => {
  assert.ok(AGENT_EXECUTION_SELECT.includes("plan_json"));
  assert.ok(AGENT_EXECUTION_SELECT.includes("current_step_id"));
  assert.ok(AGENT_EXECUTION_SELECT.includes("last_tool_name"));
  assert.ok(AGENT_EXECUTION_SELECT.includes("tool_call_count"));
  assert.ok(AGENT_EXECUTION_SELECT.includes("retry_count"));
});

test("AGENT_EXECUTION_SELECT includes error tracking", () => {
  assert.ok(AGENT_EXECUTION_SELECT.includes("last_error_code"));
  assert.ok(AGENT_EXECUTION_SELECT.includes("progress_message"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Agent Execution Select Scoped
// ─────────────────────────────────────────────────────────────────────────────

test("AGENT_EXECUTION_SELECT_SCOPED uses table alias 'a'", () => {
  assert.ok(AGENT_EXECUTION_SELECT_SCOPED.includes("a.task_id"));
  assert.ok(AGENT_EXECUTION_SELECT_SCOPED.includes("a.agent_id"));
  assert.ok(AGENT_EXECUTION_SELECT_SCOPED.includes("a.status"));
});

test("AGENT_EXECUTION_SELECT_SCOPED includes restart tracking", () => {
  assert.ok(AGENT_EXECUTION_SELECT_SCOPED.includes("runtime_instance_id"));
  assert.ok(AGENT_EXECUTION_SELECT_SCOPED.includes("restarted_from_runtime_instance_id"));
  assert.ok(AGENT_EXECUTION_SELECT_SCOPED.includes("restart_generation"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Remote Log Select
// ─────────────────────────────────────────────────────────────────────────────

test("REMOTE_LOG_SELECT contains required columns", () => {
  assert.ok(REMOTE_LOG_SELECT.includes("task_id"));
  assert.ok(REMOTE_LOG_SELECT.includes("execution_id"));
  assert.ok(REMOTE_LOG_SELECT.includes("worker_id"));
  assert.ok(REMOTE_LOG_SELECT.includes("level"));
  assert.ok(REMOTE_LOG_SELECT.includes("message"));
  assert.ok(REMOTE_LOG_SELECT.includes("created_at"));
});

test("REMOTE_LOG_SELECT maps context_json", () => {
  assert.ok(REMOTE_LOG_SELECT.includes("context_json AS \"contextJson\""));
});

test("REMOTE_LOG_SELECT includes runtime instance", () => {
  assert.ok(REMOTE_LOG_SELECT.includes("runtime_instance_id"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Remote Log Select Scoped
// ─────────────────────────────────────────────────────────────────────────────

test("REMOTE_LOG_SELECT_SCOPED uses table alias 'r'", () => {
  assert.ok(REMOTE_LOG_SELECT_SCOPED.includes("r.task_id"));
  assert.ok(REMOTE_LOG_SELECT_SCOPED.includes("r.execution_id"));
  assert.ok(REMOTE_LOG_SELECT_SCOPED.includes("r.level"));
});