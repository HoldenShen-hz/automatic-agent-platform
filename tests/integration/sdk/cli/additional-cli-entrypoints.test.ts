import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { QUEUE_JOBS_DDL } from "../../../../src/platform/execution/queue/queue-adapter-types.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function runBuiltCli(
  scriptName: string,
  options: {
    args?: string[];
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): string {
  return execFileSync(
    process.execPath,
    [join(process.cwd(), "dist", "src", "cli", scriptName), ...(options.args ?? [])],
    {
    cwd: options.cwd ?? process.cwd(),
    env: {
      ...process.env,
      ...options.env,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

function prepareDlqDatabase(dbPath: string): void {
  const db = new SqliteDatabase(dbPath);
  try {
    db.migrate();
    db.connection.exec(QUEUE_JOBS_DDL);
    db.connection.exec(`
      CREATE TABLE IF NOT EXISTS gateway_dead_letters (
        message_id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        target_id TEXT,
        failure_reason TEXT,
        last_error_message TEXT,
        last_response_status INTEGER,
        attempts INTEGER NOT NULL DEFAULT 0,
        first_failed_at TEXT,
        moved_to_dead_letter_at TEXT,
        original_request_url TEXT,
        provider_message_id TEXT
      );
      CREATE TABLE IF NOT EXISTS event_dead_letters (
        id TEXT PRIMARY KEY,
        event_type TEXT,
        consumer_id TEXT,
        error_code TEXT,
        error_message TEXT,
        dead_lettered_at TEXT,
        payload_json TEXT
      );
    `);
  } finally {
    db.close();
  }
}

test("task-board CLI returns an empty board for a fresh database", () => {
  const workspace = createTempWorkspace("aa-task-board-cli-");

  try {
    const output = runBuiltCli("task-board.js", {
      env: {
        AA_DB_PATH: join(workspace, "task-board.db"),
      },
    });

    const parsed = JSON.parse(output) as { items: unknown[] };
    assert.deepEqual(parsed.items, []);
  } finally {
    cleanupPath(workspace);
  }
});

test("stable-soak CLI writes a report into the configured output directory", () => {
  const workspace = createTempWorkspace("aa-stable-soak-cli-");
  const outputDir = join(workspace, "soak-output");

  try {
    const output = runBuiltCli("stable-soak.js", {
      env: {
        AA_SOAK_OUTPUT_DIR: outputDir,
        AA_SOAK_DURATION_MS: "25",
        AA_SOAK_INTERVAL_MS: "5",
        AA_SOAK_ITERATIONS_PER_CYCLE: "1",
      },
    });

    const parsed = JSON.parse(output) as { totalRuns: number; failedRuns: number };
    assert.ok(parsed.totalRuns >= 2);
    assert.equal(parsed.failedRuns, 0);
    assert.equal(existsSync(join(outputDir, "stable-soak-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

test("stable-sequence CLI can run-until-complete with a smoke profile and persist artifacts", () => {
  const workspace = createTempWorkspace("aa-stable-sequence-cli-");
  const evidenceRoot = join(workspace, "stable-evidence");

  try {
    const output = runBuiltCli("stable-sequence.js", {
      env: {
        AA_STABLE_SEQUENCE_EVIDENCE_ROOT: evidenceRoot,
        AA_STABLE_SEQUENCE_PROFILES: "smoke",
        AA_STABLE_SEQUENCE_RUN_UNTIL_COMPLETE: "1",
        AA_STABLE_SEQUENCE_TARGET_DURATION_MS: "25",
        AA_STABLE_SEQUENCE_SEGMENT_DURATION_MS: "25",
        AA_STABLE_SEQUENCE_INTERVAL_MS: "5",
        AA_STABLE_SEQUENCE_ITERATIONS_PER_CYCLE: "1",
        AA_STABLE_SEQUENCE_VALIDATION_ITERATIONS: "1",
        AA_STABLE_SEQUENCE_MAX_PASSES: "3",
      },
    });

    const parsed = JSON.parse(output) as {
      state: { completed: boolean; blocked: boolean; profiles: Array<{ profileName: string; completed: boolean }> };
    };
    assert.equal(parsed.state.completed, true);
    assert.equal(parsed.state.blocked, false);
    assert.deepEqual(
      parsed.state.profiles.map((profile) => ({
        profileName: profile.profileName,
        completed: profile.completed,
      })),
      [{ profileName: "smoke", completed: true }],
    );
    assert.equal(existsSync(join(evidenceRoot, "smoke", "stable-evidence-report.json")), true);
    assert.equal(existsSync(join(evidenceRoot, "stable-evidence-sequence-report.json")), true);
  } finally {
    cleanupPath(workspace);
  }
});

test("dlq-manager CLI reports zero counts for a fresh database", () => {
  const workspace = createTempWorkspace("aa-dlq-manager-cli-");

  try {
    const dbPath = join(workspace, "dlq.db");
    prepareDlqDatabase(dbPath);
    const output = runBuiltCli("dlq-manager.js", {
      args: ["-a", "count", "-q", "jobs"],
      env: {
        AA_DB_PATH: dbPath,
      },
    });

    assert.match(output, /gateway/i);
    assert.match(output, /jobs/i);
    assert.match(output, /events/i);
    assert.match(output, /total/i);
  } finally {
    cleanupPath(workspace);
  }
});

test("dlq-manager CLI lists an empty jobs dead-letter queue", () => {
  const workspace = createTempWorkspace("aa-dlq-manager-list-cli-");

  try {
    const dbPath = join(workspace, "dlq-list.db");
    prepareDlqDatabase(dbPath);
    const output = runBuiltCli("dlq-manager.js", {
      args: ["-a", "list", "-q", "jobs"],
      env: {
        AA_DB_PATH: dbPath,
      },
    });

    assert.match(output, /No job dead letters found\./);
  } finally {
    cleanupPath(workspace);
  }
});

test("dlq-manager CLI rejects invalid actions", () => {
  const workspace = createTempWorkspace("aa-dlq-manager-invalid-cli-");

  try {
    try {
      runBuiltCli("dlq-manager.js", {
        args: ["-a", "boom", "-q", "jobs"],
        env: {
          AA_DB_PATH: join(workspace, "dlq-invalid.db"),
        },
      });
      assert.fail("expected dlq-manager invalid action to fail");
    } catch (error) {
      const failure = error as { status?: number; stderr?: string };
      assert.ok((failure.status ?? 0) !== 0);
      assert.match(failure.stderr ?? "", /Invalid action/);
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("phase1b-demo CLI emits a multi-step orchestration summary", () => {
  const workspace = createTempWorkspace("aa-phase1b-demo-cli-");

  try {
    cpSync(join(process.cwd(), "divisions"), join(workspace, "divisions"), { recursive: true });
    const output = runBuiltCli("phase1b-demo.js", { cwd: workspace });
    const parsed = JSON.parse(output) as {
      routing: unknown;
      plannedSteps: Array<{ stepId: string }>;
      task: { id: string; status: string };
      streamFrames: unknown[];
    };

    assert.ok(parsed.routing);
    assert.ok(parsed.plannedSteps.length > 0);
    assert.match(parsed.task.id, /^task_/);
    assert.equal(parsed.task.status, "done");
    assert.ok(parsed.streamFrames.length > 0);
    assert.equal(existsSync(join(workspace, "data", "sqlite", "multi-step-demo.db")), true);
  } finally {
    cleanupPath(workspace);
  }
});

test("stable-soak CLI persists the same JSON payload that it prints", () => {
  const workspace = createTempWorkspace("aa-stable-soak-cli-persist-");
  const outputDir = join(workspace, "soak-output");

  try {
    const output = runBuiltCli("stable-soak.js", {
      env: {
        AA_SOAK_OUTPUT_DIR: outputDir,
        AA_SOAK_DURATION_MS: "25",
        AA_SOAK_INTERVAL_MS: "5",
        AA_SOAK_ITERATIONS_PER_CYCLE: "1",
      },
    });

    const printed = JSON.parse(output) as { totalRuns: number };
    const persisted = JSON.parse(readFileSync(join(outputDir, "stable-soak-report.json"), "utf8")) as { totalRuns: number };
    assert.equal(persisted.totalRuns, printed.totalRuns);
  } finally {
    cleanupPath(workspace);
  }
});
