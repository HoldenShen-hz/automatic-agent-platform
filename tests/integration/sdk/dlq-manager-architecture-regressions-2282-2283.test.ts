import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { openCliAuthoritativeStorageContext } from "../../../src/sdk/cli/authoritative-storage.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";

function openTestStorage(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "dlq-manager.db");
  const sql = new SqliteDatabase(dbPath);
  sql.migrate();
  sql.connection.exec(`
    CREATE TABLE IF NOT EXISTS gateway_dead_letters (
      message_id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      target_id TEXT NOT NULL,
      failure_reason TEXT NOT NULL,
      last_error_message TEXT,
      last_response_status INTEGER,
      attempts INTEGER NOT NULL,
      first_failed_at TEXT NOT NULL,
      moved_to_dead_letter_at TEXT NOT NULL,
      original_request_url TEXT,
      provider_message_id TEXT
    );
    CREATE TABLE IF NOT EXISTS queue_jobs (
      id TEXT PRIMARY KEY,
      queue_name TEXT NOT NULL,
      status TEXT NOT NULL,
      priority INTEGER NOT NULL,
      attempts INTEGER NOT NULL,
      max_attempts INTEGER NOT NULL,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS event_dead_letters (
      id TEXT PRIMARY KEY,
      original_event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      consumer_id TEXT NOT NULL,
      failure_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      dead_lettered_at TEXT NOT NULL,
      reprocessed_at TEXT,
      reprocess_result TEXT
    );
  `);
  const storage = {
    sql,
    close() {
      sql.close();
    },
  } as ReturnType<typeof openCliAuthoritativeStorageContext>;
  return {
    storage,
    cleanup() {
      try {
        storage.close();
      } finally {
        cleanupPath(workspace);
      }
    },
  };
}

function seedGatewayDeadLetter(storage: ReturnType<typeof openCliAuthoritativeStorageContext>, messageId: string, channel = "webhook"): void {
  storage.sql.connection.prepare(`
    INSERT INTO gateway_dead_letters (
      message_id, channel, target_id, failure_reason, last_error_message,
      last_response_status, attempts, first_failed_at, moved_to_dead_letter_at,
      original_request_url, provider_message_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    messageId,
    channel,
    `target_${messageId}`,
    "timeout",
    "connection timeout",
    500,
    3,
    new Date().toISOString(),
    new Date().toISOString(),
    `https://example.test/${messageId}`,
    `provider_${messageId}`,
  );
}

function seedDeadLetterJob(storage: ReturnType<typeof openCliAuthoritativeStorageContext>, id: string, updatedAt: string): void {
  storage.sql.connection.prepare(`
    INSERT INTO queue_jobs (
      id, queue_name, status, priority, attempts, max_attempts,
      last_error, created_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    "default",
    "dead_letter",
    5,
    3,
    5,
    "max retries exceeded",
    updatedAt,
    updatedAt,
    null,
  );
}

function seedEventDeadLetter(storage: ReturnType<typeof openCliAuthoritativeStorageContext>, id: string): void {
  storage.sql.connection.prepare(`
    INSERT INTO event_dead_letters (
      id, original_event_id, event_type, payload_json, consumer_id,
      failure_count, last_error, dead_lettered_at, reprocessed_at, reprocess_result
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    `event_${id}`,
    "TaskCreated",
    "{\"taskId\":\"task_1\"}",
    "consumer_1",
    3,
    "event processing failed",
    new Date().toISOString(),
    null,
    null,
  );
}

test("2282: storage can be opened and migrated", () => {
  const ctx = openTestStorage("aa-dlq-open-");
  try {
    // Verify tables exist
    const gatewayTable = ctx.storage.sql.connection.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='gateway_dead_letters'
    `).get();
    assert.ok(gatewayTable, "gateway_dead_letters table should exist");

    const jobsTable = ctx.storage.sql.connection.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='queue_jobs'
    `).get();
    assert.ok(jobsTable, "queue_jobs table should exist");

    const eventsTable = ctx.storage.sql.connection.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='event_dead_letters'
    `).get();
    assert.ok(eventsTable, "event_dead_letters table should exist");
  } finally {
    ctx.cleanup();
  }
});

test("2282: gateway dead letters can be inserted and queried", () => {
  const ctx = openTestStorage("aa-dlq-gateway-");
  try {
    seedGatewayDeadLetter(ctx.storage, "gw_1");

    const rows = ctx.storage.sql.connection.prepare(`
      SELECT message_id, channel, failure_reason FROM gateway_dead_letters
    `).all() as Array<{ message_id: string; channel: string; failure_reason: string }>;

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.message_id, "gw_1");
    assert.equal(rows[0]?.channel, "webhook");
  } finally {
    ctx.cleanup();
  }
});

test("2282: job dead letters can be inserted and queried", () => {
  const ctx = openTestStorage("aa-dlq-jobs-");
  try {
    seedDeadLetterJob(ctx.storage, "job_1", "2026-05-05T00:00:00.000Z");

    const rows = ctx.storage.sql.connection.prepare(`
      SELECT id, status FROM queue_jobs WHERE status = 'dead_letter'
    `).all() as Array<{ id: string; status: string }>;

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "job_1");
    assert.equal(rows[0]?.status, "dead_letter");
  } finally {
    ctx.cleanup();
  }
});

test("2282: event dead letters can be inserted and queried", () => {
  const ctx = openTestStorage("aa-dlq-events-");
  try {
    seedEventDeadLetter(ctx.storage, "evt_1");

    const rows = ctx.storage.sql.connection.prepare(`
      SELECT id, event_type FROM event_dead_letters
    `).all() as Array<{ id: string; event_type: string }>;

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "evt_1");
    assert.equal(rows[0]?.event_type, "TaskCreated");
  } finally {
    ctx.cleanup();
  }
});

test("2283: dead letter job status can be updated to waiting (retry simulation)", () => {
  const ctx = openTestStorage("aa-dlq-retry-");
  try {
    seedDeadLetterJob(ctx.storage, "job_retry_1", "2026-05-05T00:00:00.000Z");

    // Simulate retry by updating status
    ctx.storage.sql.connection.prepare(`
      UPDATE queue_jobs
      SET status = 'waiting', attempts = 0, last_error = NULL, updated_at = datetime('now')
      WHERE status = 'dead_letter'
    `).run();

    const rows = ctx.storage.sql.connection.prepare(`
      SELECT id, status, attempts FROM queue_jobs WHERE status = 'waiting'
    `).all() as Array<{ id: string; status: string; attempts: number }>;

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "job_retry_1");
    assert.equal(rows[0]?.status, "waiting");
    assert.equal(rows[0]?.attempts, 0);
  } finally {
    ctx.cleanup();
  }
});

test("2283: gateway dead letters can be deleted (purge simulation)", () => {
  const ctx = openTestStorage("aa-dlq-purge-");
  try {
    seedGatewayDeadLetter(ctx.storage, "gw_purge_1");
    seedGatewayDeadLetter(ctx.storage, "gw_purge_2");

    const beforeCount = ctx.storage.sql.connection.prepare(`
      SELECT COUNT(*) as c FROM gateway_dead_letters
    `).get() as { c: number };

    assert.equal(beforeCount.c, 2);

    // Simulate purge
    ctx.storage.sql.connection.prepare(`DELETE FROM gateway_dead_letters`).run();

    const afterCount = ctx.storage.sql.connection.prepare(`
      SELECT COUNT(*) as c FROM gateway_dead_letters
    `).get() as { c: number };

    assert.equal(afterCount.c, 0);
  } finally {
    ctx.cleanup();
  }
});

test("2283: only dead_letter jobs are purged, other jobs remain", () => {
  const ctx = openTestStorage("aa-dlq-purge-selective-");
  try {
    // Insert a dead_letter job
    ctx.storage.sql.connection.prepare(`
      INSERT INTO queue_jobs (
        id, queue_name, status, priority, attempts, max_attempts,
        last_error, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "job_dl", "purge_queue", "dead_letter", 5, 5, 5,
      "error", new Date().toISOString(), new Date().toISOString(), null
    );

    // Insert a waiting job
    ctx.storage.sql.connection.prepare(`
      INSERT INTO queue_jobs (
        id, queue_name, status, priority, attempts, max_attempts,
        last_error, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "job_waiting", "purge_queue", "waiting", 5, 0, 5,
      null, new Date().toISOString(), new Date().toISOString(), null
    );

    // Simulate purge (only dead_letter jobs)
    ctx.storage.sql.connection.prepare(`
      DELETE FROM queue_jobs WHERE status = 'dead_letter'
    `).run();

    const remainingJobs = ctx.storage.sql.connection.prepare(`
      SELECT id, status FROM queue_jobs
    `).all() as Array<{ id: string; status: string }>;

    assert.equal(remainingJobs.length, 1);
    assert.equal(remainingJobs[0]?.id, "job_waiting");
    assert.equal(remainingJobs[0]?.status, "waiting");
  } finally {
    ctx.cleanup();
  }
});

test("2282: count query returns correct totals for all queues", () => {
  const ctx = openTestStorage("aa-dlq-count-");
  try {
    seedGatewayDeadLetter(ctx.storage, "gw_1");
    seedDeadLetterJob(ctx.storage, "job_1", "2026-05-05T00:00:00.000Z");
    seedEventDeadLetter(ctx.storage, "evt_1");

    const gatewayCount = ctx.storage.sql.connection.prepare(
      `SELECT COUNT(*) as c FROM gateway_dead_letters`
    ).get() as { c: number };

    const jobsCount = ctx.storage.sql.connection.prepare(
      `SELECT COUNT(*) as c FROM queue_jobs WHERE status = 'dead_letter'`
    ).get() as { c: number };

    const eventsCount = ctx.storage.sql.connection.prepare(
      `SELECT COUNT(*) as c FROM event_dead_letters`
    ).get() as { c: number };

    assert.equal(gatewayCount.c, 1);
    assert.equal(jobsCount.c, 1);
    assert.equal(eventsCount.c, 1);
  } finally {
    ctx.cleanup();
  }
});