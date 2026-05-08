/**
 * @fileoverview SQLite CAS Repository - Persistent storage for Compare-And-Swap records.
 *
 * Provides durable SQLite-backed storage for CAS records, replacing the in-memory Map
 * that was lost on process restart.
 *
 * @see §25 Data Consistency in docs_zh/architecture/00-platform-architecture.md
 * @see R16-35: CAS service needs persistent backend
 */

import type { CasResult } from "./cas-service.js";
import type { SqliteConnection } from "../../truth/sqlite/query-helper.js";
import { queryOne, execute } from "../../truth/sqlite/query-helper.js";

/**
 * Record stored for CAS operations in SQLite.
 */
export interface CasRecord {
  value: string;
  version: number;
  updatedAt: Date;
}

/**
 * Raw row representation from SQLite.
 */
interface CasRecordRow {
  cas_key: string;
  value: string;
  version: number;
  updated_at: string;
}

/**
 * SQLite-backed CAS Repository providing persistent storage for CAS records.
 *
 * Implements the same interface as the in-memory Map<string, CasRecord> but
 * persists to SQLite for durability across restarts.
 */
export class SqliteCasRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  /**
   * Gets a CAS record by key.
   * @param key - The CAS key
   * @returns The CasRecord or undefined if not found
   */
  public get(key: string): CasRecord | undefined {
    const row = queryOne<CasRecordRow>(
      this.conn,
      `SELECT cas_key, value, version, updated_at FROM cas_records WHERE cas_key = ?`,
      key,
    );
    if (!row) {
      return undefined;
    }
    return {
      value: row.value,
      version: row.version,
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Sets a CAS record, inserting or updating as needed.
   * @param key - The CAS key
   * @param record - The CAS record to store
   */
  public set(key: string, record: CasRecord): void {
    this.conn
      .prepare(
        `INSERT INTO cas_records (cas_key, value, version, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(cas_key) DO UPDATE SET
           value = excluded.value,
           version = excluded.version,
           updated_at = excluded.updated_at`,
      )
      .run(key, record.value, record.version, record.updatedAt.toISOString());
  }

  /**
   * Deletes a CAS record by key.
   * @param key - The CAS key to delete
   * @returns true if a record was deleted
   */
  public delete(key: string): boolean {
    const result = execute(
      this.conn,
      `DELETE FROM cas_records WHERE cas_key = ?`,
      key,
    );
    return result > 0;
  }

  /**
   * Checks if a CAS record exists for the given key.
   * @param key - The CAS key to check
   * @returns true if a record exists
   */
  public has(key: string): boolean {
    const row = queryOne<{ count: number }>(
      this.conn,
      `SELECT COUNT(*) as count FROM cas_records WHERE cas_key = ?`,
      key,
    );
    return (row?.count ?? 0) > 0;
  }

  /**
   * Performs an atomic compare-and-swap operation using SQLite's transaction mechanism.
   *
   * @param key - The CAS key
   * @param expectedValue - The expected current value (empty string means key should not exist)
   * @param newValue - The new value to set
   * @returns Object with success flag and current state if failed
   */
  public compareAndSwap(
    key: string,
    expectedValue: string,
    newValue: string,
  ): CasResult {
    const updatedAt = new Date().toISOString();

    if (expectedValue === "" || expectedValue === null || expectedValue === undefined) {
      const inserted = execute(
        this.conn,
        `INSERT INTO cas_records (cas_key, value, version, updated_at)
         SELECT ?, ?, 1, ?
         WHERE NOT EXISTS (SELECT 1 FROM cas_records WHERE cas_key = ?)`,
        key,
        newValue,
        updatedAt,
        key,
      );
      if (inserted > 0) {
        return { success: true, currentValue: newValue, currentVersion: 1 };
      }
    }

    const updated = execute(
      this.conn,
      `UPDATE cas_records
       SET value = ?, version = version + 1, updated_at = ?
       WHERE cas_key = ? AND value = ?`,
      newValue,
      updatedAt,
      key,
      expectedValue,
    );
    if (updated > 0) {
      const current = this.get(key);
      return {
        success: true,
        currentValue: current?.value ?? newValue,
        currentVersion: current?.version ?? 1,
      };
    }

    const current = this.get(key);
    const { value, version } = current ?? {};
    return {
      success: false,
      ...(value !== undefined && { currentValue: value }),
      ...(version !== undefined && { currentVersion: version }),
    };
  }

  /**
   * Performs a version-based compare-and-set operation.
   *
   * @param key - The CAS key
   * @param expectedVersion - The expected current version (0 means key should not exist)
   * @param newValue - The new value to set
   * @returns Object with success flag and current state if failed
   */
  public compareAndSet(
    key: string,
    expectedVersion: number,
    newValue: string,
  ): CasResult {
    const updatedAt = new Date().toISOString();

    if (expectedVersion === 0) {
      const inserted = execute(
        this.conn,
        `INSERT INTO cas_records (cas_key, value, version, updated_at)
         SELECT ?, ?, 1, ?
         WHERE NOT EXISTS (SELECT 1 FROM cas_records WHERE cas_key = ?)`,
        key,
        newValue,
        updatedAt,
        key,
      );
      if (inserted > 0) {
        return { success: true, currentValue: newValue, currentVersion: 1 };
      }
    }

    const updated = execute(
      this.conn,
      `UPDATE cas_records
       SET value = ?, version = version + 1, updated_at = ?
       WHERE cas_key = ? AND version = ?`,
      newValue,
      updatedAt,
      key,
      expectedVersion,
    );
    if (updated > 0) {
      const current = this.get(key);
      return {
        success: true,
        currentValue: current?.value ?? newValue,
        currentVersion: current?.version ?? 1,
      };
    }

    const current = this.get(key);
    const { value, version } = current ?? {};
    return {
      success: false,
      ...(value !== undefined && { currentValue: value }),
      ...(version !== undefined && { currentVersion: version }),
    };
  }
}
