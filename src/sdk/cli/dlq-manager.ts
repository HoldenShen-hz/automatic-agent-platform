/**
 * DLQ Manager CLI Tool
 *
 * Manages Dead Letter Queues across three backends:
 * - Gateway DLQ (gateway_dead_letters table)
 * - Jobs DLQ (queue_jobs with status='dead_letter')
 * - Event DLQ (event_dead_letters table)
 *
 * Usage:
 *   npm run dlq -- -a list -q gateway
 *   npm run dlq -- -a count
 *   npm run dlq -- -a retry -q jobs
 *   npm run dlq -- -a purge -q events
 *   npm run dlq -- -a list -q gateway -l 50
 *
 * Environment:
 *   AA_DB_PATH - Path to SQLite database (defaults to data/sqlite/authoritative-demo.db)
 */

import { parseArgs } from "node:util";
import { openCliAuthoritativeStorageContext } from "./authoritative-storage.js";

interface DlqAction {
  action: "list" | "count" | "retry" | "purge";
  queue: "gateway" | "jobs" | "events";
  limit: number;
  channel: string | undefined;
  retryLimit: number | undefined;
  confirmed: boolean;
}

function parseArguments(): DlqAction {
  const { values } = parseArgs({
    options: {
      action: { type: "string", short: "a" },
      queue: { type: "string", short: "q" },
      limit: { type: "string", short: "l", default: "50" },
      channel: { type: "string", short: "c" },
      "retry-limit": { type: "string" },
      yes: { type: "boolean", short: "y", default: false },
    },
  });

  const action = values.action as DlqAction["action"];
  const queue = values.queue as DlqAction["queue"];

  if (!action || !["list", "count", "retry", "purge"].includes(action)) {
    throw new Error("Invalid action. Use: list, count, retry, purge");
  }
  if (!queue || !["gateway", "jobs", "events"].includes(queue)) {
    throw new Error("Invalid queue. Use: gateway, jobs, events");
  }

  return {
    action,
    queue,
    limit: Math.max(1, Math.min(500, parseInt(values.limit ?? "50", 10))),
    channel: values.channel ?? undefined,
    retryLimit: values["retry-limit"] != null ? Math.max(1, parseInt(values["retry-limit"], 10)) : undefined,
    confirmed: values.yes === true,
  };
}

function listGatewayDeadLetters(db: ReturnType<typeof openCliAuthoritativeStorageContext>, limit: number, channel?: string): void {
  const sql = db.sql.connection;
  let query = `
    SELECT message_id, channel, target_id, failure_reason, last_error_message,
           last_response_status, attempts, first_failed_at, moved_to_dead_letter_at,
           original_request_url, provider_message_id
    FROM gateway_dead_letters
  `;
  const params: (string | number)[] = [];

  if (channel) {
    query += ` WHERE channel = ?`;
    params.push(channel);
  }
  query += ` ORDER BY moved_to_dead_letter_at DESC LIMIT ?`;
  params.push(limit);

  const rows = sql.prepare(query).all(...params);
  if (rows.length === 0) {
    console.log("No gateway dead letters found.");
    return;
  }
  console.table(rows);
}

function listJobDeadLetters(db: ReturnType<typeof openCliAuthoritativeStorageContext>, limit: number): void {
  const sql = db.sql.connection;
  const rows = sql.prepare(`
    SELECT id, queue_name, status, priority, attempts, max_attempts,
           last_error, created_at, updated_at, completed_at
    FROM queue_jobs
    WHERE status = 'dead_letter'
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(limit);
  if (rows.length === 0) {
    console.log("No job dead letters found.");
    return;
  }
  console.table(rows);
}

function listEventDeadLetters(db: ReturnType<typeof openCliAuthoritativeStorageContext>, limit: number): void {
  const sql = db.sql.connection;
  const rows = sql.prepare(`
    SELECT id, event_type, consumer_id, error_code, error_message,
           dead_lettered_at, payload_json
    FROM event_dead_letters
    ORDER BY dead_lettered_at DESC
    LIMIT ?
  `).all(limit);
  if (rows.length === 0) {
    console.log("No event dead letters found.");
    return;
  }
  console.table(rows);
}

function countDeadLetters(db: ReturnType<typeof openCliAuthoritativeStorageContext>): void {
  const sql = db.sql.connection;

  const gatewayCount = (sql.prepare(`SELECT COUNT(*) as c FROM gateway_dead_letters`).get() as { c: number })?.c ?? 0;
  const jobsCount = (sql.prepare(`SELECT COUNT(*) as c FROM queue_jobs WHERE status = 'dead_letter'`).get() as { c: number })?.c ?? 0;
  const eventsCount = (sql.prepare(`SELECT COUNT(*) as c FROM event_dead_letters`).get() as { c: number })?.c ?? 0;

  console.table({
    gateway: gatewayCount,
    jobs: jobsCount,
    events: eventsCount,
    total: gatewayCount + jobsCount + eventsCount,
  });
}

function retryDeadLetters(db: ReturnType<typeof openCliAuthoritativeStorageContext>, queue: "gateway" | "jobs" | "events", limit?: number): void {
  const sql = db.sql.connection;

  if (queue === "jobs") {
    // Limit the retry to prevent unbounded state changes
    const limitClause = limit != null ? `LIMIT ${limit}` : "";
    const result = sql.prepare(`
      UPDATE queue_jobs
      SET status = 'waiting', attempts = 0, last_error = NULL, updated_at = datetime('now')
      WHERE status = 'dead_letter'
      ${limitClause}
    `).run();
    console.log(`Retried ${result.changes} dead-lettered jobs (limit: ${limit ?? "unlimited"}).`);
  } else if (queue === "gateway") {
    // Gateway DLQ doesn't have a simple retry - messages need to be re-enqueued
    const count = (sql.prepare(`SELECT COUNT(*) as c FROM gateway_dead_letters`).get() as { c: number })?.c ?? 0;
    console.log(`Gateway dead letters (${count}) cannot be directly retried. Consider re-processing or purging.`);
  } else if (queue === "events") {
    // Event DLQ retry would require re-publishing events
    const count = (sql.prepare(`SELECT COUNT(*) as c FROM event_dead_letters`).get() as { c: number })?.c ?? 0;
    console.log(`Event dead letters (${count}) cannot be directly retried. Consider re-publishing or purging.`);
  }
}

function purgeDeadLetters(db: ReturnType<typeof openCliAuthoritativeStorageContext>, queue: "gateway" | "jobs" | "events"): void {
  const sql = db.sql.connection;

  // Archive dead letters before deletion for audit/recovery purposes
  const archivedAt = new Date().toISOString();

  if (queue === "gateway") {
    // Archive gateway dead letters to audit table
    sql.prepare(`
      CREATE TABLE IF NOT EXISTS gateway_dead_letters_archive AS
      SELECT *, '${archivedAt}' as archived_at FROM gateway_dead_letters
    `).run();
    const result = sql.prepare(`DELETE FROM gateway_dead_letters`).run();
    console.log(`Archived and purged ${result.changes} gateway dead letter entries.`);
  } else if (queue === "jobs") {
    // Archive job dead letters to audit table
    sql.prepare(`
      CREATE TABLE IF NOT EXISTS queue_jobs_dead_letters_archive AS
      SELECT *, '${archivedAt}' as archived_at FROM queue_jobs WHERE status = 'dead_letter'
    `).run();
    const result = sql.prepare(`DELETE FROM queue_jobs WHERE status = 'dead_letter'`).run();
    console.log(`Archived and purged ${result.changes} dead-lettered job entries.`);
  } else if (queue === "events") {
    // Archive event dead letters to audit table
    sql.prepare(`
      CREATE TABLE IF NOT EXISTS event_dead_letters_archive AS
      SELECT *, '${archivedAt}' as archived_at FROM event_dead_letters
    `).run();
    const result = sql.prepare(`DELETE FROM event_dead_letters`).run();
    console.log(`Archived and purged ${result.changes} event dead letter entries.`);
  }
}

function main(): void {
  const args = parseArguments();

  const storage = openCliAuthoritativeStorageContext();
  storage.migrate();

  try {
    switch (args.action) {
      case "list":
        if (args.queue === "gateway") {
          listGatewayDeadLetters(storage, args.limit, args.channel);
        } else if (args.queue === "jobs") {
          listJobDeadLetters(storage, args.limit);
        } else if (args.queue === "events") {
          listEventDeadLetters(storage, args.limit);
        }
        break;
      case "count":
        countDeadLetters(storage);
        break;
      case "retry":
        // Require confirmation for retry operations that would affect all dead letters
        if (!args.confirmed && args.retryLimit == null) {
          console.error("WARNING: retry without --retry-limit will affect ALL dead letters.");
          console.error("Use --retry-limit N to limit, or --yes to confirm and retry all.");
          console.error("Aborting for safety. Run with --yes or --retry-limit N to proceed.");
          process.exit(1);
        }
        retryDeadLetters(storage, args.queue, args.retryLimit);
        break;
      case "purge":
        // Require explicit confirmation for purge operations
        if (!args.confirmed) {
          console.error("WARNING: purge will PERMANENTLY DELETE all dead letters from the queue.");
          console.error("This action cannot be undone. Use --yes to confirm.");
          console.error("Aborting for safety. Run with --yes to proceed.");
          process.exit(1);
        }
        purgeDeadLetters(storage, args.queue);
        break;
    }
  } finally {
    storage.close();
  }
}

main();
