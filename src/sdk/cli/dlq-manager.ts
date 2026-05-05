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

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { openCliAuthoritativeStorageContext } from "./authoritative-storage.js";

const MAX_LIST_LIMIT = 500;
const MAX_RETRY_LIMIT = 500;

export interface DlqAction {
  action: "list" | "count" | "retry" | "purge";
  queue: "gateway" | "jobs" | "events";
  limit: number;
  channel: string | undefined;
  retryLimit: number | undefined;
  confirmed: boolean;
}

interface DlqArgumentValues {
  action?: string;
  queue?: string;
  limit?: string;
  channel?: string;
  "retry-limit"?: string;
  yes?: boolean;
}

interface DlqOperationAuditRecord {
  operationId: string;
  action: DlqAction["action"];
  queue: DlqAction["queue"];
  affectedCount: number;
  archivedCount: number;
  confirmed: boolean;
  limitApplied: number | null;
  createdAt: string;
}

export interface DlqPurgeResult {
  operationId: string;
  deleted: number;
  archived: number;
}

function parseBoundedInteger(
  raw: string | undefined,
  fieldName: string,
  options: { defaultValue?: number; min: number; max: number },
): number | undefined {
  if (raw == null) {
    return options.defaultValue;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid ${fieldName}. Must be an integer between ${options.min} and ${options.max}`);
  }
  return Math.max(options.min, Math.min(options.max, parsed));
}

function readArgumentValues(input?: DlqArgumentValues): DlqArgumentValues {
  if (input != null) {
    return input;
  }
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
  return {
    action: values.action,
    queue: values.queue,
    limit: values.limit,
    channel: values.channel,
    "retry-limit": values["retry-limit"],
    yes: values.yes === true,
  };
}

export function parseArguments(input?: DlqArgumentValues): DlqAction {
  const values = readArgumentValues(input);
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
    limit: parseBoundedInteger(values.limit, "limit", {
      defaultValue: 50,
      min: 1,
      max: MAX_LIST_LIMIT,
    }) ?? 50,
    channel: values.channel ?? undefined,
    retryLimit: parseBoundedInteger(values["retry-limit"], "retry-limit", {
      min: 1,
      max: MAX_RETRY_LIMIT,
    }),
    confirmed: values.yes === true,
  };
}

function ensureArchiveTable(
  sql: ReturnType<typeof openCliAuthoritativeStorageContext>["sql"]["connection"],
  archiveTable: string,
  sourceTable: string,
): void {
  sql.exec(`
    CREATE TABLE IF NOT EXISTS ${archiveTable} AS
    SELECT *, '' AS archived_at, '' AS operation_id
    FROM ${sourceTable}
    WHERE 0;
  `);
  try {
    sql.exec(`ALTER TABLE ${archiveTable} ADD COLUMN archived_at TEXT NOT NULL DEFAULT '';`);
  } catch (error) {
    if (!(error instanceof Error) || !/duplicate column name/i.test(error.message)) {
      throw error;
    }
  }
  try {
    sql.exec(`ALTER TABLE ${archiveTable} ADD COLUMN operation_id TEXT NOT NULL DEFAULT '';`);
  } catch (error) {
    if (!(error instanceof Error) || !/duplicate column name/i.test(error.message)) {
      throw error;
    }
  }
}

function ensureDlqAuditTable(sql: ReturnType<typeof openCliAuthoritativeStorageContext>["sql"]["connection"]): void {
  sql.exec(`
    CREATE TABLE IF NOT EXISTS dlq_operation_audits (
      operation_id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      queue TEXT NOT NULL,
      affected_count INTEGER NOT NULL,
      archived_count INTEGER NOT NULL,
      confirmed INTEGER NOT NULL,
      limit_applied INTEGER,
      created_at TEXT NOT NULL
    );
  `);
}

function recordDlqAudit(
  sql: ReturnType<typeof openCliAuthoritativeStorageContext>["sql"]["connection"],
  record: DlqOperationAuditRecord,
): void {
  ensureDlqAuditTable(sql);
  sql.prepare(`
    INSERT INTO dlq_operation_audits (
      operation_id,
      action,
      queue,
      affected_count,
      archived_count,
      confirmed,
      limit_applied,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.operationId,
    record.action,
    record.queue,
    record.affectedCount,
    record.archivedCount,
    record.confirmed ? 1 : 0,
    record.limitApplied,
    record.createdAt,
  );
}

export function listGatewayDeadLetters(
  db: ReturnType<typeof openCliAuthoritativeStorageContext>,
  limit: number,
  channel?: string,
): Array<Record<string, unknown>> {
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

  const rows = sql.prepare(query).all(...params) as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    console.log("No gateway dead letters found.");
    return [];
  }
  console.table(rows);
  return rows;
}

export function listJobDeadLetters(
  db: ReturnType<typeof openCliAuthoritativeStorageContext>,
  limit: number,
): Array<Record<string, unknown>> {
  const sql = db.sql.connection;
  const rows = sql.prepare(`
    SELECT id, queue_name, status, priority, attempts, max_attempts,
           last_error, created_at, updated_at, completed_at
    FROM queue_jobs
    WHERE status = 'dead_letter'
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(limit) as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    console.log("No job dead letters found.");
    return [];
  }
  console.table(rows);
  return rows;
}

export function listEventDeadLetters(
  db: ReturnType<typeof openCliAuthoritativeStorageContext>,
  limit: number,
): Array<Record<string, unknown>> {
  const sql = db.sql.connection;
  const rows = sql.prepare(`
    SELECT id, original_event_id, event_type, payload_json,
           consumer_id, failure_count, last_error,
           dead_lettered_at, reprocessed_at, reprocess_result
    FROM event_dead_letters
    ORDER BY dead_lettered_at DESC
    LIMIT ?
  `).all(limit) as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    console.log("No event dead letters found.");
    return [];
  }
  console.table(rows);
  return rows;
}

export function countDeadLetters(db: ReturnType<typeof openCliAuthoritativeStorageContext>): Record<string, number> {
  const sql = db.sql.connection;

  const gatewayCount = (sql.prepare(`SELECT COUNT(*) as c FROM gateway_dead_letters`).get() as { c: number })?.c ?? 0;
  const jobsCount = (sql.prepare(`SELECT COUNT(*) as c FROM queue_jobs WHERE status = 'dead_letter'`).get() as { c: number })?.c ?? 0;
  const eventsCount = (sql.prepare(`SELECT COUNT(*) as c FROM event_dead_letters`).get() as { c: number })?.c ?? 0;
  const counts = {
    gateway: gatewayCount,
    jobs: jobsCount,
    events: eventsCount,
    total: gatewayCount + jobsCount + eventsCount,
  };

  console.table(counts);
  return counts;
}

export function retryDeadLetters(
  db: ReturnType<typeof openCliAuthoritativeStorageContext>,
  queue: "gateway" | "jobs" | "events",
  options: { limit?: number; confirmed?: boolean } = {},
): number {
  const sql = db.sql.connection;
  const operationId = newId("dlqop");
  const createdAt = nowIso();

  if (queue === "jobs") {
    const retried = db.sql.transaction(() => {
      const changes =
        options.limit == null
          ? sql.prepare(`
            UPDATE queue_jobs
            SET status = 'waiting', attempts = 0, last_error = NULL, updated_at = datetime('now')
            WHERE status = 'dead_letter'
          `).run().changes
          : sql.prepare(`
            UPDATE queue_jobs
            SET status = 'waiting', attempts = 0, last_error = NULL, updated_at = datetime('now')
            WHERE id IN (
              SELECT id
              FROM queue_jobs
              WHERE status = 'dead_letter'
              ORDER BY updated_at DESC, id ASC
              LIMIT ?
            )
          `).run(options.limit).changes;
      recordDlqAudit(sql, {
        operationId,
        action: "retry",
        queue,
        affectedCount: changes,
        archivedCount: 0,
        confirmed: options.confirmed === true,
        limitApplied: options.limit ?? null,
        createdAt,
      });
      return changes;
    });
    console.log(
      options.limit == null
        ? `Retried ${retried} dead-lettered jobs.`
        : `Retried ${retried} dead-lettered jobs (limit: ${options.limit}).`,
    );
    return retried;
  } else if (queue === "gateway") {
    const count = (sql.prepare(`SELECT COUNT(*) as c FROM gateway_dead_letters`).get() as { c: number })?.c ?? 0;
    console.log(`Gateway dead letters (${count}) cannot be directly retried. Consider re-processing or purging.`);
    return 0;
  } else if (queue === "events") {
    const count = (sql.prepare(`SELECT COUNT(*) as c FROM event_dead_letters`).get() as { c: number })?.c ?? 0;
    console.log(`Event dead letters (${count}) cannot be directly retried. Consider re-publishing or purging.`);
    return 0;
  }
  return 0;
}

export function purgeDeadLetters(
  db: ReturnType<typeof openCliAuthoritativeStorageContext>,
  queue: "gateway" | "jobs" | "events",
  options: { confirmed?: boolean } = {},
): DlqPurgeResult {
  const sql = db.sql.connection;
  const operationId = newId("dlqop");
  const archivedAt = nowIso();

  if (queue === "gateway") {
    const result = db.sql.transaction(() => {
      ensureArchiveTable(sql, "gateway_dead_letters_archive", "gateway_dead_letters");
      const archived = sql.prepare(`
        INSERT INTO gateway_dead_letters_archive
        SELECT *, ?, ?
        FROM gateway_dead_letters
      `).run(archivedAt, operationId).changes;
      const deleted = sql.prepare(`DELETE FROM gateway_dead_letters`).run().changes;
      recordDlqAudit(sql, {
        operationId,
        action: "purge",
        queue,
        affectedCount: deleted,
        archivedCount: archived,
        confirmed: options.confirmed === true,
        limitApplied: null,
        createdAt: archivedAt,
      });
      return { operationId, deleted, archived };
    });
    console.log(`Archived and purged ${result.deleted} gateway dead letter entries.`);
    return result;
  } else if (queue === "jobs") {
    const result = db.sql.transaction(() => {
      ensureArchiveTable(sql, "queue_jobs_dead_letters_archive", "queue_jobs");
      const archived = sql.prepare(`
        INSERT INTO queue_jobs_dead_letters_archive
        SELECT *, ?, ?
        FROM queue_jobs
        WHERE status = 'dead_letter'
      `).run(archivedAt, operationId).changes;
      const deleted = sql.prepare(`DELETE FROM queue_jobs WHERE status = 'dead_letter'`).run().changes;
      recordDlqAudit(sql, {
        operationId,
        action: "purge",
        queue,
        affectedCount: deleted,
        archivedCount: archived,
        confirmed: options.confirmed === true,
        limitApplied: null,
        createdAt: archivedAt,
      });
      return { operationId, deleted, archived };
    });
    console.log(`Archived and purged ${result.deleted} dead-lettered job entries.`);
    return result;
  } else if (queue === "events") {
    const result = db.sql.transaction(() => {
      ensureArchiveTable(sql, "event_dead_letters_archive", "event_dead_letters");
      const archived = sql.prepare(`
        INSERT INTO event_dead_letters_archive
        SELECT *, ?, ?
        FROM event_dead_letters
      `).run(archivedAt, operationId).changes;
      const deleted = sql.prepare(`DELETE FROM event_dead_letters`).run().changes;
      recordDlqAudit(sql, {
        operationId,
        action: "purge",
        queue,
        affectedCount: deleted,
        archivedCount: archived,
        confirmed: options.confirmed === true,
        limitApplied: null,
        createdAt: archivedAt,
      });
      return { operationId, deleted, archived };
    });
    console.log(`Archived and purged ${result.deleted} event dead letter entries.`);
    return result;
  }
  return { operationId, deleted: 0, archived: 0 };
}

export function main(): void {
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
        retryDeadLetters(storage, args.queue, {
          ...(args.retryLimit != null ? { limit: args.retryLimit } : {}),
          confirmed: args.confirmed,
        });
        break;
      case "purge":
        // Require explicit confirmation for purge operations
        if (!args.confirmed) {
          console.error("WARNING: purge will PERMANENTLY DELETE all dead letters from the queue.");
          console.error("This action cannot be undone. Use --yes to confirm.");
          console.error("Aborting for safety. Run with --yes to proceed.");
          process.exit(1);
        }
        purgeDeadLetters(storage, args.queue, { confirmed: args.confirmed });
        break;
    }
  } finally {
    storage.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
