/**
 * @fileoverview CAS Service - Compare-And-Swap operations for optimistic concurrency control.
 *
 * ## Overview
 *
 * Provides atomic compare-and-swap operations for StateCommands and other
 * resources requiring optimistic concurrency control. Implements version-based
 * CAS with expected value matching.
 *
 * ## Key Concepts
 *
 * - **CAS (Compare-And-Swap)**: Atomic operation that updates a value only if it matches expected value
 * - **Version**: Monotonically increasing version number for each key
 * - **Fencing Token**: Unique token generated per execution to prevent split-brain
 *
 * @see §25 Data Consistency in docs_zh/architecture/00-platform-architecture.md
 * @see R16-35: CAS service now uses SQLite-backed SqliteCasRepository for durable storage
 */

/**
 * Result of a CAS operation indicating success or failure.
 */
export interface CasResult {
  success: boolean;
  currentValue?: string | undefined;
  currentVersion?: number | undefined;
}

/**
 * Record stored for CAS operations.
 */
interface CasRecord {
  value: string;
  version: number;
  updatedAt: Date;
}

/**
 * Interface for CAS record storage backends.
 */
export interface CasRepository {
  get(key: string): CasRecord | undefined;
  set(key: string, record: CasRecord): void;
  delete(key: string): boolean;
  has(key: string): boolean;
  compareAndSwap(key: string, expectedValue: string, newValue: string): CasResult;
  compareAndSet(key: string, expectedVersion: number, newValue: string): CasResult;
}

/**
 * CAS Service providing optimistic concurrency control via compare-and-swap operations.
 *
 * Implements:
 * - Value-based CAS: compareAndSwap(key, expectedValue, newValue)
 * - Version-based CAS: compareAndSet(key, expectedVersion, newValue)
 * - Read operations: getValue(key), getVersion(key)
 *
 * R16-35: Now uses SQLite-backed SqliteCasRepository for durable storage
 * instead of in-memory Map which lost state on restart.
 */
export class CasService {
  private readonly store: CasRepository;

  /**
   * Creates a new CasService with the given repository.
   *
   * @param store - The storage backend for CAS records (e.g., SqliteCasRepository)
   */
  public constructor(store: CasRepository) {
    this.store = store;
  }

  /**
   * Performs an atomic compare-and-swap operation.
   *
   * Updates the value only if the current value matches the expected value.
   *
   * @param key - The key to update
   * @param expectedValue - The value expected to be current
   * @param newValue - The new value to set if expectedValue matches
   * @returns CasResult indicating success and current state
   */
  public compareAndSwap(key: string, expectedValue: string, newValue: string): CasResult {
    return this.store.compareAndSwap(key, expectedValue, newValue);
  }

  /**
   * Performs a version-based compare-and-set operation.
   *
   * Updates the value only if the current version matches the expected version.
   *
   * @param key - The key to update
   * @param expectedVersion - The version expected to be current
   * @param newValue - The new value to set if version matches
   * @returns CasResult indicating success and current state
   */
  public compareAndSet(key: string, expectedVersion: number, newValue: string): CasResult {
    return this.store.compareAndSet(key, expectedVersion, newValue);
  }

  /**
   * Reads the current value for a key.
   *
   * @param key - The key to read
   * @returns The current value or undefined if not found
   */
  public getValue(key: string): string | undefined {
    return this.store.get(key)?.value;
  }

  /**
   * Reads the current version for a key.
   *
   * @param key - The key to read
   * @returns The current version or undefined if not found
   */
  public getVersion(key: string): number | undefined {
    return this.store.get(key)?.version;
  }

  /**
   * Sets a value directly (without CAS), initializing version to 1.
   *
   * @param key - The key to set
   * @param value - The value to set
   */
  public setValue(key: string, value: string): void {
    const existing = this.store.get(key);
    // R16-16 FIX: Increment version on setValue instead of resetting to 1
    const newVersion = existing ? existing.version + 1 : 1;
    this.store.set(key, {
      value,
      version: newVersion,
      updatedAt: new Date(),
    });
  }

  /**
   * Deletes a key from the store.
   *
   * @param key - The key to delete
   * @returns true if the key was deleted, false if it didn't exist
   */
  public delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Checks if a key exists in the store.
   *
   * @param key - The key to check
   * @returns true if the key exists
   */
  public has(key: string): boolean {
    return this.store.has(key);
  }
}

/**
 * In-memory CAS repository for testing and development.
 * This is NOT durable and should only be used in tests.
 *
 * R29-37 fix: NOTE - This in-memory Map will NOT work across multiple nodes in a
 * distributed deployment. The CAS operations are not atomic across processes.
 * For production distributed environments, this needs a Redis or PostgreSQL backend
 * that supports atomic compare-and-swap operations with proper fencing tokens.
 */
class InMemoryCasRepository implements CasRepository {
  private readonly store = new Map<string, CasRecord>();

  public get(key: string): CasRecord | undefined {
    return this.store.get(key);
  }

  public set(key: string, record: CasRecord): void {
    this.store.set(key, record);
  }

  public delete(key: string): boolean {
    return this.store.delete(key);
  }

  public has(key: string): boolean {
    return this.store.has(key);
  }

  public compareAndSwap(key: string, expectedValue: string, newValue: string): CasResult {
    const current = this.store.get(key);

    if (current === undefined) {
      if (expectedValue === "" || expectedValue === null || expectedValue === undefined) {
        // R30-05 FIX: When creating a new record, ensure version starts at 1.
        // Note: When current is undefined (new record), version should be 1.
        // The previous bug was that version=1 was used everywhere, even when
        // incrementing existing records. Here we simply start at version 1
        // for genuinely new records.
        this.set(key, {
          value: newValue,
          version: 1,
          updatedAt: new Date(),
        });
        return {
          success: true,
          currentValue: newValue,
          currentVersion: 1,
        };
      }
      return { success: false };
    }

    if (current.value !== expectedValue) {
      return {
        success: false,
        currentValue: current.value,
        currentVersion: current.version,
      };
    }

    const nextVersion = current.version + 1;
    this.set(key, {
      value: newValue,
      version: nextVersion,
      updatedAt: new Date(),
    });
    return {
      success: true,
      currentValue: newValue,
      currentVersion: nextVersion,
    };
  }

  public compareAndSet(key: string, expectedVersion: number, newValue: string): CasResult {
    const current = this.store.get(key);

    if (current === undefined) {
      if (expectedVersion === 0) {
        this.set(key, {
          value: newValue,
          version: 1,
          updatedAt: new Date(),
        });
        return {
          success: true,
          currentValue: newValue,
          currentVersion: 1,
        };
      }
      return { success: false };
    }

    if (current.version !== expectedVersion) {
      return {
        success: false,
        currentValue: current.value,
        currentVersion: current.version,
      };
    }

    const nextVersion = current.version + 1;
    this.set(key, {
      value: newValue,
      version: nextVersion,
      updatedAt: new Date(),
    });
    return {
      success: true,
      currentValue: newValue,
      currentVersion: nextVersion,
    };
  }
}

/**
 * Creates an in-memory CAS service (non-durable, for testing only).
 *
 * @deprecated Use SqliteCasRepository in production. This function exists
 * only for backward compatibility with tests.
 */
export function createInMemoryCasService(): CasService {
  return new CasService(new InMemoryCasRepository());
}
