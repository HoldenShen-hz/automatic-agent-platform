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
import { pathToFileURL } from "node:url";
import { ValidationError } from "../../platform/contracts/errors.js";
import { QUEUE_JOBS_DDL } from "../../platform/five-plane-execution/queue/queue-adapter-types.js";
import { CHANNEL_DELIVERY_DDL } from "../../platform/five-plane-interface/channel-gateway/channel-gateway-delivery-support.js";
import { openCliAuthoritativeStorageContext } from "./authoritative-storage.js";

interface DlqAction {
  action: "list" | "count" | "retry" | "purge";
  queue: "gateway" | "jobs" | "events";
  limit: number;
  channel: string | undefined;
  retryLimit?: number;
  confirmed?: boolean;
}

function writeLine(message: string): void {
  process.stdout.write(`${message}\n`);
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function ensureDlqSchemas(db: ReturnType<typeof openCliAuthoritativeStorageContext>): void {
  db.sql.connection.exec(QUEUE_JOBS_DDL);
  db.sql.connection.exec(CHANNEL_DELIVERY_DDL);
}

export function parseArguments(overrides?: Record<string, string | boolean | undefined>): DlqAction {
  const values = overrides ?? parseArgs({
    options: {
      action: { type: "string", short: "a" },
      queue: { type: "string", short: "q" },
      limit: { type: "string", short: "l", default: "50" },
      channel: { type: "string", short: "c" },
      "retry-limit": { type: "string" },
      yes: { type: "boolean", short: "y" },
    },
  }).values;

  const action = values.action as DlqAction["action"];
  const queue = values.queue as DlqAction["queue"];

  if (!action || !["list", "count", "retry", "purge"].includes(action)) {
    throw new ValidationError("dlq.invalid_action", "Invalid action. Use: list, count, retry, purge");
  }
  if (!queue || !["gateway", "jobs", "events"].includes(queue)) {
    throw new ValidationError("dlq.invalid_queue", "Invalid queue. Use: gateway, jobs, events");
  }

  const retryLimitRaw = values["retry-limit"];
  const retryLimit = retryLimitRaw == null ? undefined : Number.parseInt(String(retryLimitRaw), 10);
  if (retryLimitRaw != null && (retryLimit == null || !Number.isInteger(retryLimit) || retryLimit <= 0)) {
    throw new ValidationError("dlq.invalid_retry_limit", "Invalid retry-limit. Use a positive integer.");
  }

  return {
    action,
    queue,
    limit: Math.max(1, Math.min(500, parseInt(String(values.limit ?? "50"), 10))),
    channel: typeof values.channel === "string" ? values.channel : undefined,
    ...(retryLimit == null ? {} : { retryLimit }),
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
    writeLine("No gateway dead letters found.");
    return;
  }
  writeJson(rows);
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
    writeLine("No job dead letters found.");
    return;
  }
  writeJson(rows);
}

function listEventDeadLetters(db: ReturnType<typeof openCliAuthoritativeStorageContext>, limit: number): void {
  const sql = db.sql.connection;
  const rows = sql.prepare(`
    SELECT id,
           original_event_id AS originalEventId,
           event_type,
           consumer_id,
           failure_count,
           last_error,
           dead_lettered_at,
           reprocessed_at,
           reprocess_result,
           payload_json
    FROM event_dead_letters
    ORDER BY dead_lettered_at DESC
    LIMIT ?
  `).all(limit);
  if (rows.length === 0) {
    writeLine("No event dead letters found.");
    return;
  }
  writeJson(rows);
}

function countDeadLetters(db: ReturnType<typeof openCliAuthoritativeStorageContext>): void {
  const sql = db.sql.connection;

  const gatewayCount = (sql.prepare(`SELECT COUNT(*) as c FROM gateway_dead_letters`).get() as { c: number })?.c ?? 0;
  const jobsCount = (sql.prepare(`SELECT COUNT(*) as c FROM queue_jobs WHERE status = 'dead_letter'`).get() as { c: number })?.c ?? 0;
  const eventsCount = (sql.prepare(`SELECT COUNT(*) as c FROM event_dead_letters`).get() as { c: number })?.c ?? 0;

  writeJson({
    gateway: gatewayCount,
    jobs: jobsCount,
    events: eventsCount,
    total: gatewayCount + jobsCount + eventsCount,
  });
}

function retryDeadLetters(db: ReturnType<typeof openCliAuthoritativeStorageContext>, queue: "gateway" | "jobs" | "events"): void {
  const sql = db.sql.connection;

  if (queue === "jobs") {
    // R31-40 FIX: Add batch limit to retry - reset attempts but limit to 100 records at a time
    const result = sql.prepare(`
      UPDATE queue_jobs
      SET status = 'waiting', attempts = 0, last_error = NULL, updated_at = datetime('now')
      WHERE status = 'dead_letter'
      ORDER BY updated_at ASC
      LIMIT 100
    `).run();
    writeLine(`Retried up to ${result.changes} dead-lettered jobs (batch limit: 100).`);
  } else if (queue === "gateway") {
    // Gateway DLQ doesn't have a simple retry - messages need to be re-enqueued
    const count = (sql.prepare(`SELECT COUNT(*) as c FROM gateway_dead_letters`).get() as { c: number })?.c ?? 0;
    writeLine(`Gateway dead letters (${count}) cannot be directly retried. Consider re-processing or purging.`);
  } else if (queue === "events") {
    // Event DLQ retry would require re-publishing events
    const count = (sql.prepare(`SELECT COUNT(*) as c FROM event_dead_letters`).get() as { c: number })?.c ?? 0;
    writeLine(`Event dead letters (${count}) cannot be directly retried. Consider re-publishing or purging.`);
  }
}

function purgeDeadLetters(db: ReturnType<typeof openCliAuthoritativeStorageContext>, queue: "gateway" | "jobs" | "events"): void {
  const sql = db.sql.connection;

  // R31-34 FIX: Require --confirm flag for purge operations to prevent accidental deletion
  const confirmFlag = process.env.AA_DLQ_PURGE_CONFIRM ?? "";
  if (confirmFlag !== "yes") {
    writeLine("Purge operation requires AA_DLQ_PURGE_CONFIRM=yes environment variable.");
    writeLine(`Dry-run: Would delete all ${queue} dead letter records.`);
    writeLine("Set AA_DLQ_PURGE_CONFIRM=yes to proceed with actual deletion.");
    return;
  }

  if (queue === "gateway") {
    const result = sql.prepare(`DELETE FROM gateway_dead_letters`).run();
    writeLine(`Purged ${result.changes} gateway dead letter entries.`);
  } else if (queue === "jobs") {
    const result = sql.prepare(`DELETE FROM queue_jobs WHERE status = 'dead_letter'`).run();
    writeLine(`Purged ${result.changes} dead-lettered job entries.`);
  } else if (queue === "events") {
    const result = sql.prepare(`DELETE FROM event_dead_letters`).run();
    writeLine(`Purged ${result.changes} event dead letter entries.`);
  }
}

function main(): void {
  const args = parseArguments();

  const storage = openCliAuthoritativeStorageContext();
  storage.migrate();
  ensureDlqSchemas(storage);

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
        retryDeadLetters(storage, args.queue);
        break;
      case "purge":
        purgeDeadLetters(storage, args.queue);
        break;
    }
  } finally {
    storage.close();
  }
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
