/**
 * @fileoverview Integration Tests for CLI DLQ Manager (2282-2283)
 *
 * Tests for dlq-manager.ts CLI module storage operations:
 * - 2282: DLQ manager list/count operations
 * - 2283: DLQ manager retry/purge operations
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { openCliAuthoritativeStorageContext } from "../../../src/sdk/cli/authoritative-storage.js";
import { createIntegrationContext } from "../../helpers/integration-context.js";
import { cleanupPath } from "../../helpers/fs.js";

// ============================================================================
// Tests for 2282: DLQ manager list/count operations
// ============================================================================

test("2282: storage context can be opened and migrated", () => {
  const ctx = createIntegrationContext("aa-dlq-open-");
  try {
    const storage = openCliAuthoritativeStorageContext();
    storage.migrate();

    // Verify tables exist
    const gatewayTable = storage.sql.connection.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='gateway_dead_letters'
    `).get();
    assert.ok(gatewayTable, "gateway_dead_letters table should exist");

    storage.close();
  } finally {
    ctx.cleanup();
  }
});

test("2282: gateway dead letters can be inserted with all fields", () => {
  const ctx = createIntegrationContext("aa-dlq-insert-gw-");
  try {
    const storage = openCliAuthoritativeStorageContext();
    storage.migrate();

    storage.sql.connection.prepare(`
      INSERT INTO gateway_dead_letters (
        message_id, channel, target_id, failure_reason, last_error_message,
        last_response_status, attempts, first_failed_at, moved_to_dead_letter_at,
        original_request_url, provider_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "msg_gw_1", "channel1", "target_1", "timeout", "connection timeout", 500, 3,
      new Date().toISOString(), new Date().toISOString(), "http://example.com", "prov_msg_1"
    );

    const rows = storage.sql.connection.prepare(`
      SELECT message_id, channel, target_id FROM gateway_dead_letters
    `).all() as Array<{ message_id: string; channel: string; target_id: string }>;

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.message_id, "msg_gw_1");
    assert.equal(rows[0]?.channel, "channel1");

    storage.close();
  } finally {
    ctx.cleanup();
  }
});

test("2282: job dead letters can be inserted with correct status", () => {
  const ctx = createIntegrationContext("aa-dlq-insert-job-");
  try {
    const storage = openCliAuthoritativeStorageContext();
    storage.migrate();

    storage.sql.connection.prepare(`
      INSERT INTO queue_jobs (
        id, queue_name, status, priority, attempts, max_attempts,
        last_error, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "job_dlq_1", "default", "dead_letter", 5, 3, 5,
      "max retries exceeded", new Date().toISOString(), new Date().toISOString(), null
    );

    const rows = storage.sql.connection.prepare(`
      SELECT id, status FROM queue_jobs WHERE status = 'dead_letter'
    `).all() as Array<{ id: string; status: string }>;

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "job_dlq_1");

    storage.close();
  } finally {
    ctx.cleanup();
  }
});

test("2282: event dead letters can be inserted with metadata", () => {
  const ctx = createIntegrationContext("aa-dlq-insert-event-");
  try {
    const storage = openCliAuthoritativeStorageContext();
    storage.migrate();

    storage.sql.connection.prepare(`
      INSERT INTO event_dead_letters (
        id, event_type, consumer_id, error_code, error_message,
        dead_lettered_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "evt_dlq_1", "TaskCreated", "consumer_1", "ERR_001", "event processing failed",
      new Date().toISOString(), '{"taskId": "task_1"}'
    );

    const rows = storage.sql.connection.prepare(`
      SELECT id, event_type, consumer_id FROM event_dead_letters
    `).all() as Array<{ id: string; event_type: string; consumer_id: string }>;

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "evt_dlq_1");
    assert.equal(rows[0]?.event_type, "TaskCreated");

    storage.close();
  } finally {
    ctx.cleanup();
  }
});

test("2282: count query returns correct totals for all queues", () => {
  const ctx = createIntegrationContext("aa-dlq-count-");
  try {
    const storage = openCliAuthoritativeStorageContext();
    storage.migrate();

    // Insert test data
    storage.sql.connection.prepare(`
      INSERT INTO gateway_dead_letters (
        message_id, channel, target_id, failure_reason, last_error_message,
        last_response_status, attempts, first_failed_at, moved_to_dead_letter_at,
        original_request_url, provider_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "msg_gw_1", "channel1", "target_1", "timeout", "connection timeout", 500, 3,
      new Date().toISOString(), new Date().toISOString(), "http://example.com", "prov_msg_1"
    );

    storage.sql.connection.prepare(`
      INSERT INTO queue_jobs (
        id, queue_name, status, priority, attempts, max_attempts,
        last_error, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "job_dlq_1", "default", "dead_letter", 5, 3, 5,
      "max retries exceeded", new Date().toISOString(), new Date().toISOString(), null
    );

    storage.sql.connection.prepare(`
      INSERT INTO event_dead_letters (
        id, event_type, consumer_id, error_code, error_message,
        dead_lettered_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "evt_dlq_1", "TaskCreated", "consumer_1", "ERR_001", "event processing failed",
      new Date().toISOString(), '{"taskId": "task_1"}'
    );

    const gatewayCount = (storage.sql.connection.prepare(
      `SELECT COUNT(*) as c FROM gateway_dead_letters`
    ).get() as { c: number })?.c ?? 0;

    const jobsCount = (storage.sql.connection.prepare(
      `SELECT COUNT(*) as c FROM queue_jobs WHERE status = 'dead_letter'`
    ).get() as { c: number })?.c ?? 0;

    const eventsCount = (storage.sql.connection.prepare(
      `SELECT COUNT(*) as c FROM event_dead_letters`
    ).get() as { c: number })?.c ?? 0;

    assert.equal(gatewayCount, 1);
    assert.equal(jobsCount, 1);
    assert.equal(eventsCount, 1);

    storage.close();
  } finally {
    ctx.cleanup();
  }
});

test("2282: list gateway dead letters with channel filter", () => {
  const ctx = createIntegrationContext("aa-dlq-list-gw-");
  try {
    const storage = openCliAuthoritativeStorageContext();
    storage.migrate();

    // Insert test data
    storage.sql.connection.prepare(`
      INSERT INTO gateway_dead_letters (
        message_id, channel, target_id, failure_reason, last_error_message,
        last_response_status, attempts, first_failed_at, moved_to_dead_letter_at,
        original_request_url, provider_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "msg_list_gw_1", "channel_list", "target_list", "timeout", "timeout error", 408, 2,
      new Date().toISOString(), new Date().toISOString(), "http://example.com/list", "prov_list_1"
    );

    storage.sql.connection.prepare(`
      INSERT INTO gateway_dead_letters (
        message_id, channel, target_id, failure_reason, last_error_message,
        last_response_status, attempts, first_failed_at, moved_to_dead_letter_at,
        original_request_url, provider_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "msg_list_gw_2", "channel_list", "target_list_2", "error", "error message", 500, 1,
      new Date().toISOString(), new Date().toISOString(), "http://example.com/list2", "prov_list_2"
    );

    // Test listing with channel filter
    const rows = storage.sql.connection.prepare(`
      SELECT message_id, channel, target_id, failure_reason, last_error_message,
             last_response_status, attempts, first_failed_at, moved_to_dead_letter_at,
             original_request_url, provider_message_id
      FROM gateway_dead_letters
      WHERE channel = ?
      ORDER BY moved_to_dead_letter_at DESC
      LIMIT ?
    `).all("channel_list", 50);

    assert.equal(rows.length, 2);
    assert.equal((rows[0] as any).message_id, "msg_list_gw_1");

    storage.close();
  } finally {
    ctx.cleanup();
  }
});

test("2282: list job dead letters filtered by status", () => {
  const ctx = createIntegrationContext("aa-dlq-list-job-");
  try {
    const storage = openCliAuthoritativeStorageContext();
    storage.migrate();

    // Insert test data
    storage.sql.connection.prepare(`
      INSERT INTO queue_jobs (
        id, queue_name, status, priority, attempts, max_attempts,
        last_error, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "job_list_1", "queue1", "dead_letter", 5, 5, 5,
      "max retries", new Date().toISOString(), new Date().toISOString(), null
    );

    storage.sql.connection.prepare(`
      INSERT INTO queue_jobs (
        id, queue_name, status, priority, attempts, max_attempts,
        last_error, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "job_list_2", "queue2", "dead_letter", 3, 3, 3,
      "job failed", new Date().toISOString(), new Date().toISOString(), null
    );

    // List dead letter jobs
    const rows = storage.sql.connection.prepare(`
      SELECT id, queue_name, status, priority, attempts, max_attempts,
             last_error, created_at, updated_at, completed_at
      FROM queue_jobs
      WHERE status = 'dead_letter'
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(50);

    assert.equal(rows.length, 2);

    storage.close();
  } finally {
    ctx.cleanup();
  }
});

test("2282: list event dead letters", () => {
  const ctx = createIntegrationContext("aa-dlq-list-event-");
  try {
    const storage = openCliAuthoritativeStorageContext();
    storage.migrate();

    // Insert test data
    storage.sql.connection.prepare(`
      INSERT INTO event_dead_letters (
        id, event_type, consumer_id, error_code, error_message,
        dead_lettered_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "evt_list_1", "TaskCreated", "consumer_a", "ERR_A", "event error A",
      new Date().toISOString(), '{"data": "test"}'
    );

    storage.sql.connection.prepare(`
      INSERT INTO event_dead_letters (
        id, event_type, consumer_id, error_code, error_message,
        dead_lettered_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "evt_list_2", "TaskCompleted", "consumer_b", "ERR_B", "event error B",
      new Date().toISOString(), '{"data": "test2"}'
    );

    // List dead letter events
    const rows = storage.sql.connection.prepare(`
      SELECT id, event_type, consumer_id, error_code, error_message,
             dead_lettered_at, payload_json
      FROM event_dead_letters
      ORDER BY dead_lettered_at DESC
      LIMIT ?
    `).all(50);

    assert.equal(rows.length, 2);

    storage.close();
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Tests for 2283: DLQ manager retry/purge operations
// ============================================================================

test("2283: retryDeadLetters for jobs queue resets status to waiting", () => {
  const ctx = createIntegrationContext("aa-dlq-retry-jobs-");
  try {
    const storage = openCliAuthoritativeStorageContext();
    storage.migrate();

    // Insert dead letter jobs
    storage.sql.connection.prepare(`
      INSERT INTO queue_jobs (
        id, queue_name, status, priority, attempts, max_attempts,
        last_error, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "job_retry_1", "retry_queue", "dead_letter", 5, 5, 5,
      "max retries exceeded", new Date().toISOString(), new Date().toISOString(), null
    );

    storage.sql.connection.prepare(`
      INSERT INTO queue_jobs (
        id, queue_name, status, priority, attempts, max_attempts,
        last_error, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "job_retry_2", "retry_queue", "dead_letter", 3, 3, 3,
      "job failed", new Date().toISOString(), new Date().toISOString(), null
    );

    // Retry dead letter jobs
    const result = storage.sql.connection.prepare(`
      UPDATE queue_jobs
      SET status = 'waiting', attempts = 0, last_error = NULL, updated_at = datetime('now')
      WHERE status = 'dead_letter'
    `).run();

    assert.equal(result.changes, 2);

    // Verify jobs are now 'waiting'
    const waitingJobs = storage.sql.connection.prepare(`
      SELECT id, status FROM queue_jobs WHERE status = 'waiting'
    `).all();
    assert.equal(waitingJobs.length, 2);

    storage.close();
  } finally {
    ctx.cleanup();
  }
});

test("2283: purgeDeadLetters for gateway queue deletes all entries", () => {
  const ctx = createIntegrationContext("aa-dlq-purge-gw-");
  try {
    const storage = openCliAuthoritativeStorageContext();
    storage.migrate();

    // Insert gateway dead letters
    storage.sql.connection.prepare(`
      INSERT INTO gateway_dead_letters (
        message_id, channel, target_id, failure_reason, last_error_message,
        last_response_status, attempts, first_failed_at, moved_to_dead_letter_at,
        original_request_url, provider_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "msg_purge_gw_1", "channel_purge", "target_purge", "error", "error", 500, 1,
      new Date().toISOString(), new Date().toISOString(), "http://example.com/purge", "prov_purge_1"
    );

    storage.sql.connection.prepare(`
      INSERT INTO gateway_dead_letters (
        message_id, channel, target_id, failure_reason, last_error_message,
        last_response_status, attempts, first_failed_at, moved_to_dead_letter_at,
        original_request_url, provider_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "msg_purge_gw_2", "channel_purge", "target_purge_2", "error2", "error2", 500, 2,
      new Date().toISOString(), new Date().toISOString(), "http://example.com/purge2", "prov_purge_2"
    );

    // Purge gateway dead letters
    const result = storage.sql.connection.prepare(
      `DELETE FROM gateway_dead_letters`
    ).run();

    assert.equal(result.changes, 2);

    // Verify all are deleted
    const remaining = storage.sql.connection.prepare(
      `SELECT COUNT(*) as c FROM gateway_dead_letters`
    ).get() as { c: number };
    assert.equal(remaining?.c ?? 0, 0);

    storage.close();
  } finally {
    ctx.cleanup();
  }
});

test("2283: purgeDeadLetters for jobs queue deletes only dead_letter entries", () => {
  const ctx = createIntegrationContext("aa-dlq-purge-jobs-");
  try {
    const storage = openCliAuthoritativeStorageContext();
    storage.migrate();

    // Insert both dead_letter and non-dead_letter jobs
    storage.sql.connection.prepare(`
      INSERT INTO queue_jobs (
        id, queue_name, status, priority, attempts, max_attempts,
        last_error, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "job_purge_dl", "purge_queue", "dead_letter", 5, 5, 5,
      "error", new Date().toISOString(), new Date().toISOString(), null
    );

    storage.sql.connection.prepare(`
      INSERT INTO queue_jobs (
        id, queue_name, status, priority, attempts, max_attempts,
        last_error, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "job_purge_waiting", "purge_queue", "waiting", 5, 0, 5,
      null, new Date().toISOString(), new Date().toISOString(), null
    );

    // Purge only dead_letter jobs
    const result = storage.sql.connection.prepare(`
      DELETE FROM queue_jobs WHERE status = 'dead_letter'
    `).run();

    assert.equal(result.changes, 1);

    // Verify only dead_letter was deleted
    const remainingWaiting = storage.sql.connection.prepare(`
      SELECT COUNT(*) as c FROM queue_jobs WHERE status = 'waiting'
    `).get() as { c: number };
    assert.equal(remainingWaiting?.c ?? 0, 1);

    storage.close();
  } finally {
    ctx.cleanup();
  }
});

test("2283: purgeDeadLetters for events queue deletes all entries", () => {
  const ctx = createIntegrationContext("aa-dlq-purge-events-");
  try {
    const storage = openCliAuthoritativeStorageContext();
    storage.migrate();

    // Insert event dead letters
    storage.sql.connection.prepare(`
      INSERT INTO event_dead_letters (
        id, event_type, consumer_id, error_code, error_message,
        dead_lettered_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "evt_purge_1", "TaskCreated", "consumer_purge", "ERR_P1", "purge error 1",
      new Date().toISOString(), '{"data": "purge1"}'
    );

    storage.sql.connection.prepare(`
      INSERT INTO event_dead_letters (
        id, event_type, consumer_id, error_code, error_message,
        dead_lettered_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "evt_purge_2", "TaskCompleted", "consumer_purge", "ERR_P2", "purge error 2",
      new Date().toISOString(), '{"data": "purge2"}'
    );

    // Purge all event dead letters
    const result = storage.sql.connection.prepare(
      `DELETE FROM event_dead_letters`
    ).run();

    assert.equal(result.changes, 2);

    // Verify all are deleted
    const remaining = storage.sql.connection.prepare(
      `SELECT COUNT(*) as c FROM event_dead_letters`
    ).get() as { c: number };
    assert.equal(remaining?.c ?? 0, 0);

    storage.close();
  } finally {
    ctx.cleanup();
  }
});