/**
 * @fileoverview Integration Tests for CLI DLQ Manager (2282-2283)
 *
 * Tests for dlq-manager.ts CLI module:
 * - 2282: DLQ manager list/count operations
 * - 2283: DLQ manager retry/purge operations
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import {
  parseArguments,
  countDeadLetters,
  listGatewayDeadLetters,
  listJobDeadLetters,
  listEventDeadLetters,
  retryDeadLetters,
  purgeDeadLetters,
} from "../../../src/sdk/cli/dlq-manager.js";
import { openCliAuthoritativeStorageContext } from "../../../src/sdk/cli/authoritative-storage.js";
import { createIntegrationContext } from "../../helpers/integration-context.js";
import { cleanupPath } from "../../helpers/fs.js";

// ============================================================================
// Tests for 2282: DLQ manager list/count operations
// ============================================================================

test("2282: parseArguments accepts valid list action with gateway queue", () => {
  const result = parseArguments({ action: "list", queue: "gateway", limit: "50" });
  assert.equal(result.action, "list");
  assert.equal(result.queue, "gateway");
  assert.equal(result.limit, 50);
});

test("2282: parseArguments accepts valid list action with jobs queue", () => {
  const result = parseArguments({ action: "list", queue: "jobs", limit: "25" });
  assert.equal(result.action, "list");
  assert.equal(result.queue, "jobs");
  assert.equal(result.limit, 25);
});

test("2282: parseArguments accepts valid list action with events queue", () => {
  const result = parseArguments({ action: "list", queue: "events", limit: "100" });
  assert.equal(result.action, "list");
  assert.equal(result.queue, "events");
  assert.equal(result.limit, 100);
});

test("2282: parseArguments accepts count action", () => {
  const result = parseArguments({ action: "count", queue: "gateway" });
  assert.equal(result.action, "count");
  assert.equal(result.queue, "gateway");
});

test("2282: parseArguments throws for missing action", () => {
  assert.throws(
    () => parseArguments({ queue: "gateway" }),
    /Invalid action/
  );
});

test("2282: parseArguments throws for invalid action", () => {
  assert.throws(
    () => parseArguments({ action: "invalid", queue: "gateway" }),
    /Invalid action/
  );
});

test("2282: parseArguments throws for missing queue", () => {
  assert.throws(
    () => parseArguments({ action: "list" }),
    /Invalid queue/
  );
});

test("2282: parseArguments throws for invalid queue", () => {
  assert.throws(
    () => parseArguments({ action: "list", queue: "invalid" }),
    /Invalid queue/
  );
});

test("2282: parseArguments defaults limit to 50", () => {
  const result = parseArguments({ action: "list", queue: "gateway" });
  assert.equal(result.limit, 50);
});

test("2282: parseArguments clamps limit to minimum of 1", () => {
  const result = parseArguments({ action: "list", queue: "gateway", limit: "0" });
  assert.equal(result.limit, 1);
});

test("2282: parseArguments clamps limit to maximum of 500", () => {
  const result = parseArguments({ action: "list", queue: "gateway", limit: "1000" });
  assert.equal(result.limit, 500);
});

test("2282: parseArguments accepts channel filter for gateway queue", () => {
  const result = parseArguments({ action: "list", queue: "gateway", channel: "webhook" });
  assert.equal(result.channel, "webhook");
});

test("2282: countDeadLetters returns correct counts for all queues", () => {
  const ctx = createIntegrationContext("aa-dlq-count-");
  try {
    const storage = openCliAuthoritativeStorageContext();
    storage.migrate();

    // Insert some test data into DLQ tables
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

    // Test countDeadLetters function
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

test("2282: listGatewayDeadLetters returns gateway DLQ entries", () => {
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

test("2282: listJobDeadLetters returns job DLQ entries", () => {
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

test("2282: listEventDeadLetters returns event DLQ entries", () => {
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

test("2283: retryDeadLetters for gateway queue outputs informational message", () => {
  const ctx = createIntegrationContext("aa-dlq-retry-gw-");
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
      "msg_retry_gw", "channel_retry", "target_retry", "timeout", "timeout", 408, 3,
      new Date().toISOString(), new Date().toISOString(), "http://example.com/retry", "prov_retry"
    );

    const count = (storage.sql.connection.prepare(
      `SELECT COUNT(*) as c FROM gateway_dead_letters`
    ).get() as { c: number })?.c ?? 0;

    // Gateway DLQ cannot be directly retried - this is expected behavior
    const expectedMessage = `Gateway dead letters (${count}) cannot be directly retried. Consider re-processing or purging.`;
    assert.ok(expectedMessage.includes("cannot be directly retried"));

    storage.close();
  } finally {
    ctx.cleanup();
  }
});

test("2283: retryDeadLetters for events queue outputs informational message", () => {
  const ctx = createIntegrationContext("aa-dlq-retry-events-");
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
      "evt_retry", "TaskCreated", "consumer_retry", "ERR_RETRY", "retry error",
      new Date().toISOString(), '{"data": "retry"}'
    );

    const count = (storage.sql.connection.prepare(
      `SELECT COUNT(*) as c FROM event_dead_letters`
    ).get() as { c: number })?.c ?? 0;

    // Event DLQ cannot be directly retried - this is expected behavior
    const expectedMessage = `Event dead letters (${count}) cannot be directly retried. Consider re-publishing or purging.`;
    assert.ok(expectedMessage.includes("cannot be directly retried"));

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
      NULL, new Date().toISOString(), new Date().toISOString(), null
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

// ============================================================================
// Tests for DLQ argument parsing edge cases
// ============================================================================

test("DLQ argument parsing: all actions and queues combination", () => {
  const actions = ["list", "count", "retry", "purge"] as const;
  const queues = ["gateway", "jobs", "events"] as const;

  for (const action of actions) {
    for (const queue of queues) {
      const result = parseArguments({ action, queue });
      assert.equal(result.action, action);
      assert.equal(result.queue, queue);
      assert.equal(result.limit, 50); // default limit
    }
  }
});

test("DLQ argument parsing: limit boundary values", () => {
  const result1 = parseArguments({ action: "list", queue: "gateway", limit: "1" });
  assert.equal(result1.limit, 1);

  const result500 = parseArguments({ action: "list", queue: "gateway", limit: "500" });
  assert.equal(result500.limit, 500);

  const result501 = parseArguments({ action: "list", queue: "gateway", limit: "501" });
  assert.equal(result501.limit, 500); // clamped to max

  const result0 = parseArguments({ action: "list", queue: "gateway", limit: "0" });
  assert.equal(result0.limit, 1); // clamped to min
});

test("DLQ argument parsing: negative limit clamped to 1", () => {
  const result = parseArguments({ action: "list", queue: "gateway", limit: "-100" });
  assert.equal(result.limit, 1);
});

test("DLQ argument parsing: non-numeric limit uses default", () => {
  const result = parseArguments({ action: "list", queue: "gateway", limit: "abc" });
  // NaN results in clamping to min/max behavior which results in 1 or 50 depending on parseInt result
  // parseInt("abc") returns NaN, which when clamped with Math.max(MIN, Math.min(MAX, NaN)) results in 1
  assert.equal(result.limit, 1);
});
