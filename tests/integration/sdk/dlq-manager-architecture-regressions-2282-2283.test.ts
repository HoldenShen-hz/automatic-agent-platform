import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import {
  countDeadLetters,
  listEventDeadLetters,
  listGatewayDeadLetters,
  purgeDeadLetters,
  retryDeadLetters,
} from "../../../src/sdk/cli/dlq-manager.ts";
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

test("2282: countDeadLetters returns authoritative totals", () => {
  const ctx = openTestStorage("aa-dlq-count-");
  try {
    seedGatewayDeadLetter(ctx.storage, "gw_1");
    seedDeadLetterJob(ctx.storage, "job_1", "2026-05-05T00:00:00.000Z");
    seedEventDeadLetter(ctx.storage, "evt_1");

    assert.deepEqual(countDeadLetters(ctx.storage), {
      gateway: 1,
      jobs: 1,
      events: 1,
      total: 3,
    });
  } finally {
    ctx.cleanup();
  }
});

test("2282: listEventDeadLetters reads the migrated event DLQ schema", () => {
  const ctx = openTestStorage("aa-dlq-event-list-");
  try {
    seedEventDeadLetter(ctx.storage, "evt_1");

    const rows = listEventDeadLetters(ctx.storage, 10);
    const firstRow = { ...(rows[0] ?? {}) };
    assert.equal(rows.length, 1);
    assert.deepEqual(firstRow, {
      id: "evt_1",
      original_event_id: "event_evt_1",
      event_type: "TaskCreated",
      payload_json: "{\"taskId\":\"task_1\"}",
      consumer_id: "consumer_1",
      failure_count: 3,
      last_error: "event processing failed",
      dead_lettered_at: firstRow["dead_lettered_at"],
      reprocessed_at: null,
      reprocess_result: null,
    });
  } finally {
    ctx.cleanup();
  }
});

test("2282: listGatewayDeadLetters applies channel filter", () => {
  const ctx = openTestStorage("aa-dlq-list-");
  try {
    seedGatewayDeadLetter(ctx.storage, "gw_webhook_1", "webhook");
    seedGatewayDeadLetter(ctx.storage, "gw_email_1", "email");

    const filtered = listGatewayDeadLetters(ctx.storage, 50, "webhook");
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.["message_id"], "gw_webhook_1");
  } finally {
    ctx.cleanup();
  }
});

test("2282: retryDeadLetters with limit only requeues newest jobs and writes audit", () => {
  const ctx = openTestStorage("aa-dlq-retry-limit-");
  try {
    seedDeadLetterJob(ctx.storage, "job_old", "2026-05-05T00:00:00.000Z");
    seedDeadLetterJob(ctx.storage, "job_new", "2026-05-05T00:00:01.000Z");

    const retried = retryDeadLetters(ctx.storage, "jobs", { limit: 1, confirmed: false });
    assert.equal(retried, 1);

    const deadLetterRows = ctx.storage.sql.connection.prepare(`
      SELECT id
      FROM queue_jobs
      WHERE status = 'dead_letter'
      ORDER BY id ASC
    `).all() as Array<{ id: string }>;
    const waitingRows = ctx.storage.sql.connection.prepare(`
      SELECT id
      FROM queue_jobs
      WHERE status = 'waiting'
      ORDER BY id ASC
    `).all() as Array<{ id: string }>;
    const auditRow = ctx.storage.sql.connection.prepare(`
      SELECT action, queue, affected_count, archived_count, confirmed, limit_applied
      FROM dlq_operation_audits
      ORDER BY created_at DESC
      LIMIT 1
    `).get() as Record<string, number | string | null>;
    const normalizedAuditRow = { ...auditRow };

    assert.deepEqual(deadLetterRows.map((row) => row.id), ["job_old"]);
    assert.deepEqual(waitingRows.map((row) => row.id), ["job_new"]);
    assert.deepEqual(normalizedAuditRow, {
      action: "retry",
      queue: "jobs",
      affected_count: 1,
      archived_count: 0,
      confirmed: 0,
      limit_applied: 1,
    });
  } finally {
    ctx.cleanup();
  }
});

test("2283: purgeDeadLetters archives deleted rows and appends audit history", () => {
  const ctx = openTestStorage("aa-dlq-purge-archive-");
  try {
    seedGatewayDeadLetter(ctx.storage, "gw_purge_1");
    const first = purgeDeadLetters(ctx.storage, "gateway", { confirmed: true });
    assert.equal(first.deleted, 1);
    assert.equal(first.archived, 1);

    seedGatewayDeadLetter(ctx.storage, "gw_purge_2");
    const second = purgeDeadLetters(ctx.storage, "gateway", { confirmed: true });
    assert.equal(second.deleted, 1);
    assert.equal(second.archived, 1);

    const archiveCount = ctx.storage.sql.connection.prepare(`
      SELECT COUNT(*) AS count
      FROM gateway_dead_letters_archive
    `).get() as { count: number };
    const auditRows = ctx.storage.sql.connection.prepare(`
      SELECT action, queue, affected_count, archived_count, confirmed
      FROM dlq_operation_audits
      ORDER BY created_at ASC
    `).all() as Array<Record<string, number | string>>;
    const normalizedAuditRows = auditRows.map((row) => ({ ...row }));

    assert.equal(archiveCount.count, 2);
    assert.deepEqual(normalizedAuditRows[0], {
      action: "purge",
      queue: "gateway",
      affected_count: 1,
      archived_count: 1,
      confirmed: 1,
    });
    assert.deepEqual(normalizedAuditRows[1], {
      action: "purge",
      queue: "gateway",
      affected_count: 1,
      archived_count: 1,
      confirmed: 1,
    });
  } finally {
    ctx.cleanup();
  }
});
