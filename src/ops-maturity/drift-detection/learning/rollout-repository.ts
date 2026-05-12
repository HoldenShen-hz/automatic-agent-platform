/**
 * Rollout Repository
 *
 * SQLite persistence for rollout records. Provides durable storage
 * so rollouts survive process restarts.
 */

import type { RolloutRecord } from "./rollout-manager.js";
import type { SqliteDatabase } from "../../../platform/state-evidence/truth/sqlite/sqlite-database.js";

/**
 * Repository for persisting RolloutRecords to SQLite.
 * Handles CRUD operations for rollout state durability.
 */
export class RolloutRepository {
  public constructor(private readonly db: SqliteDatabase) {}

  /**
   * Persists a new rollout record.
   */
  insert(record: RolloutRecord): void {
    this.runWrite(() => {
      this.db.connection.prepare(
        `INSERT INTO rollout_records (
          proposal_id, stage, percentage, started_at, completed_at,
          status, metrics_json, failure_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        record.proposalId,
        record.stage,
        record.percentage,
        record.startedAt,
        record.completedAt ?? null,
        record.status,
        record.metrics ? JSON.stringify(record.metrics) : null,
        record.failureReason ?? null,
      );
    });
  }

  /**
   * Updates an existing rollout record.
   */
  update(record: RolloutRecord): void {
    this.runWrite(() => {
      this.db.connection.prepare(
        `UPDATE rollout_records SET
          stage = ?, percentage = ?, started_at = ?, completed_at = ?,
          status = ?, metrics_json = ?, failure_reason = ?
        WHERE proposal_id = ?`,
      ).run(
        record.stage,
        record.percentage,
        record.startedAt,
        record.completedAt ?? null,
        record.status,
        record.metrics ? JSON.stringify(record.metrics) : null,
        record.failureReason ?? null,
        record.proposalId,
      );
    });
  }

  /**
   * Retrieves a rollout record by proposal ID.
   */
  getByProposalId(proposalId: string): RolloutRecord | null {
    const row = this.db.connection.prepare(
      `SELECT
        proposal_id AS "proposalId",
        stage,
        percentage,
        started_at AS "startedAt",
        completed_at AS "completedAt",
        status,
        metrics_json AS "metricsJson",
        failure_reason AS "failureReason"
      FROM rollout_records
      WHERE proposal_id = ?`,
    ).get(proposalId) as unknown as RolloutRow | undefined;

    if (!row) return null;
    return this.rowToRecord(row);
  }

  /**
   * Lists all active (running or rollback_pending) rollouts.
   */
  listActive(): RolloutRecord[] {
    const rows = this.db.connection.prepare(
      `SELECT
        proposal_id AS "proposalId",
        stage,
        percentage,
        started_at AS "startedAt",
        completed_at AS "completedAt",
        status,
        metrics_json AS "metricsJson",
        failure_reason AS "failureReason"
      FROM rollout_records
      WHERE status IN ('running', 'rollback_pending')
      ORDER BY started_at ASC`,
    ).all() as unknown as RolloutRow[];

    return rows.map((row) => this.rowToRecord(row));
  }

  /**
   * Lists all rollout records.
   */
  listAll(): RolloutRecord[] {
    const rows = this.db.connection.prepare(
      `SELECT
        proposal_id AS "proposalId",
        stage,
        percentage,
        started_at AS "startedAt",
        completed_at AS "completedAt",
        status,
        metrics_json AS "metricsJson",
        failure_reason AS "failureReason"
      FROM rollout_records
      ORDER BY started_at DESC`,
    ).all() as unknown as RolloutRow[];

    return rows.map((row) => this.rowToRecord(row));
  }

  /**
   * Deletes a rollout record by proposal ID.
   */
  delete(proposalId: string): void {
    this.runWrite(() => {
      this.db.connection.prepare(
        `DELETE FROM rollout_records WHERE proposal_id = ?`,
      ).run(proposalId);
    });
  }

  private runWrite(work: () => void): void {
    const transaction = (this.db as { transaction?: (callback: () => void) => void }).transaction;
    if (typeof transaction === "function") {
      transaction.call(this.db, work);
      return;
    }
    work();
  }

  private rowToRecord(row: RolloutRow): RolloutRecord {
    const record: RolloutRecord = {
      proposalId: row.proposalId,
      stage: row.stage as RolloutRecord["stage"],
      percentage: row.percentage,
      startedAt: row.startedAt,
      status: row.status as RolloutRecord["status"],
    };
    if (row.completedAt) {
      record.completedAt = row.completedAt;
    }
    if (row.metricsJson) {
      record.metrics = JSON.parse(row.metricsJson);
    }
    if (row.failureReason) {
      record.failureReason = row.failureReason;
    }
    return record;
  }
}

interface RolloutRow {
  proposalId: string;
  stage: string;
  percentage: number;
  startedAt: string;
  completedAt: string | null;
  status: string;
  metricsJson: string | null;
  failureReason: string | null;
}

/**
 * SQL schema for rollout_records table.
 * Apply via migration or on db initialization.
 */
export const ROLLOUT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS rollout_records (
  proposal_id TEXT PRIMARY KEY,
  stage TEXT NOT NULL,
  percentage INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT NULL,
  status TEXT NOT NULL,
  metrics_json TEXT NULL,
  failure_reason TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_rollout_records_status
  ON rollout_records(status);
CREATE INDEX IF NOT EXISTS idx_rollout_records_started_at
  ON rollout_records(started_at);
`;
