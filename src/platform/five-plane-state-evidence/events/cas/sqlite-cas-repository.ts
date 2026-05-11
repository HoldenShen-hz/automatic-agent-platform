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
  public constructor(private readonly conn: SqliteConnection) {
    this.ensureSchema();
  }

  private ensureSchema(): void {
    this.conn.exec(`
      CREATE TABLE IF NOT EXISTS cas_records (
        cas_key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cas_records_version ON cas_records(version);
    `);
  }

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
   * Uses BEGIN IMMEDIATE to acquire a write lock atomically, ensuring that
   * read-check-write operations are atomic at the database level.
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

    // Use BEGIN IMMEDIATE to acquire write lock atomically
    // This ensures read-check-write is atomic at database level
    this.conn.exec("BEGIN IMMEDIATE");

    try {
      let currentValue: string | undefined;
      let currentVersion: number | undefined;

      const currentRow = queryOne<CasRecordRow>(
        this.conn,
        `SELECT cas_key, value, version, updated_at FROM cas_records WHERE cas_key = ?`,
        key,
      );

      if (currentRow) {
        currentValue = currentRow.value;
        currentVersion = currentRow.version;
      }

      let success = false;
      let resultNewValue = newValue;
      let resultVersion = 1;

      if (currentValue === undefined) {
        // Key does not exist
        if (expectedValue === "" || expectedValue === null || expectedValue === undefined) {
          // Insert new record
          this.conn
            .prepare(
              `INSERT INTO cas_records (cas_key, value, version, updated_at)
             VALUES (?, ?, 1, ?)`,
            )
            .run(key, newValue, updatedAt);
          success = true;
          resultNewValue = newValue;
          resultVersion = 1;
        } else {
          // Expected value doesn't match - key doesn't exist
          success = false;
        }
      } else if (currentValue !== expectedValue) {
        // Value mismatch
        success = false;
        resultNewValue = currentValue;
        resultVersion = currentVersion!;
      } else {
        // Value matches - perform update with version increment
        this.conn
          .prepare(
            `UPDATE cas_records
             SET value = ?, version = version + 1, updated_at = ?
             WHERE cas_key = ? AND value = ?`,
          )
          .run(newValue, updatedAt, key, expectedValue);
        success = true;
        resultNewValue = newValue;
        resultVersion = currentVersion! + 1;
      }

      this.conn.exec("COMMIT");

      if (success) {
        return { success: true, currentValue: resultNewValue, currentVersion: resultVersion };
      } else {
        return {
          success: false,
          ...(currentValue !== undefined && { currentValue }),
          ...(currentVersion !== undefined && { currentVersion }),
        };
      }
    } catch (error) {
      this.conn.exec("ROLLBACK");
      throw error;
    }
  }

  /**
   * Performs a version-based compare-and-set operation using atomic transaction.
   *
   * Uses BEGIN IMMEDIATE to acquire a write lock atomically, ensuring that
   * read-check-write operations are atomic at the database level.
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

    // Use BEGIN IMMEDIATE to acquire write lock atomically
    this.conn.exec("BEGIN IMMEDIATE");

    try {
      let currentValue: string | undefined;
      let currentVersion: number | undefined;

      const currentRow = queryOne<CasRecordRow>(
        this.conn,
        `SELECT cas_key, value, version, updated_at FROM cas_records WHERE cas_key = ?`,
        key,
      );

      if (currentRow) {
        currentValue = currentRow.value;
        currentVersion = currentRow.version;
      }

      let success = false;
      let resultNewValue = newValue;
      let resultVersion = 1;

      if (currentVersion === undefined) {
        // Key does not exist
        if (expectedVersion === 0) {
          // Insert new record
          this.conn
            .prepare(
              `INSERT INTO cas_records (cas_key, value, version, updated_at)
             VALUES (?, ?, 1, ?)`,
            )
            .run(key, newValue, updatedAt);
          success = true;
          resultNewValue = newValue;
          resultVersion = 1;
        } else {
          // Expected version doesn't match - key doesn't exist
          success = false;
        }
      } else if (currentVersion !== expectedVersion) {
        // Version mismatch
        success = false;
        resultNewValue = currentValue!;
        resultVersion = currentVersion;
      } else {
        // Version matches - perform update with version increment
        this.conn
          .prepare(
            `UPDATE cas_records
             SET value = ?, version = version + 1, updated_at = ?
             WHERE cas_key = ? AND version = ?`,
          )
          .run(newValue, updatedAt, key, expectedVersion);
        success = true;
        resultNewValue = newValue;
        resultVersion = currentVersion + 1;
      }

      this.conn.exec("COMMIT");

      if (success) {
        return { success: true, currentValue: resultNewValue, currentVersion: resultVersion };
      } else {
        return {
          success: false,
          ...(currentValue !== undefined && { currentValue }),
          ...(currentVersion !== undefined && { currentVersion }),
        };
      }
    } catch (error) {
      this.conn.exec("ROLLBACK");
      throw error;
    }
  }
}
