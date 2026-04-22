import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";

function runCli<T>(env: NodeJS.ProcessEnv): T {
  const stdout = execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "sdk", "cli", "control-plane-balancer.js")], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });
  return JSON.parse(stdout) as T;
}

test("control-plane-balancer CLI persists heartbeats and selects the best coordinator", () => {
  const workspace = createTempWorkspace("aa-control-plane-cli-");
  const dbPath = join(workspace, "control-plane-cli.db");

  try {
    const heartbeatA = runCli<{ coordinatorId: string; region: string }>({
      AA_DB_PATH: dbPath,
      AA_CONTROL_PLANE_ACTION: "heartbeat",
      AA_COORDINATOR_ID: "coord-west-1",
      AA_COORDINATOR_REGION: "us-west",
      AA_COORDINATOR_QUEUE: "default",
      AA_COORDINATOR_ACTIVE_DISPATCHES: "1",
      AA_COORDINATOR_BACKLOG: "0",
      AA_COORDINATOR_CPU_PCT: "18",
      AA_COORDINATOR_SHARDS_JSON: JSON.stringify(["tenant-cli"]),
    });
    assert.equal(heartbeatA.coordinatorId, "coord-west-1");
    assert.equal(heartbeatA.region, "us-west");

    runCli<{ coordinatorId: string }>({
      AA_DB_PATH: dbPath,
      AA_CONTROL_PLANE_ACTION: "heartbeat",
      AA_COORDINATOR_ID: "coord-east-1",
      AA_COORDINATOR_REGION: "us-east",
      AA_COORDINATOR_QUEUE: "default",
      AA_COORDINATOR_ACTIVE_DISPATCHES: "7",
      AA_COORDINATOR_BACKLOG: "5",
      AA_COORDINATOR_CPU_PCT: "88",
      AA_COORDINATOR_SHARDS_JSON: JSON.stringify(["tenant-cli"]),
    });

    const summary = runCli<{
      summary: { coordinatorCount: number; activeCount: number };
      coordinators: Array<{ coordinatorId: string }>;
    }>({
      AA_DB_PATH: dbPath,
    });
    assert.equal(summary.summary.coordinatorCount, 2);
    assert.equal(summary.summary.activeCount, 2);
    assert.ok(summary.coordinators.some((entry) => entry.coordinatorId === "coord-west-1"));

    const selection = runCli<{
      outcome: string;
      selectedCoordinatorId: string | null;
    }>({
      AA_DB_PATH: dbPath,
      AA_CONTROL_PLANE_ACTION: "select",
      AA_CONTROL_PLANE_QUEUE: "default",
      AA_CONTROL_PLANE_REGION: "us-west",
      AA_CONTROL_PLANE_TENANT_ID: "tenant-cli",
      AA_CONTROL_PLANE_REQUEST_KEY: "req-cli-1",
    });
    assert.equal(selection.outcome, "selected");
    assert.equal(selection.selectedCoordinatorId, "coord-west-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("control-plane-balancer CLI fail-closes when postgres storage execution is requested", () => {
  const failure = runBuiltCliExpectFailure("control-plane-balancer.js", {
    AA_DB_PATH: "/tmp/control-plane-balancer-postgres.db",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
  });

  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
