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
 */

/**
 * Result of a CAS operation indicating success or failure.
 */
export interface CasResult {
  success: boolean;
  currentValue?: string;
  currentVersion?: number;
}

/**
 * Record stored for CAS operations.
 */
export interface CasRecord {
  value: string;
  version: number;
  updatedAt: Date;
}

export interface CasRepository {
  get(key: string): CasRecord | undefined;
  set(key: string, record: CasRecord): void;
  delete(key: string): boolean;
  has(key: string): boolean;
  compareAndSwap(key: string, expectedValue: string, newValue: string): CasResult;
  compareAndSet(key: string, expectedVersion: number, newValue: string): CasResult;
}

class InMemoryCasRepository implements CasRepository {
  private readonly store = new Map<string, CasRecord>();
  private readonly locks = new Map<string, number>();
  private lockIdCounter = 0;

  /**
   * Acquires a lock for a specific key using a simple in-memory locking mechanism.
   * Uses a counter-based lock acquisition that's suitable for single-process concurrency.
   * @returns A function to release the lock
   */
  private acquireLock(key: string): () => void {
    let lockId: number;
    do {
      lockId = ++this.lockIdCounter;
    } while (this.locks.get(key) !== undefined);

    this.locks.set(key, lockId);

    return () => {
      if (this.locks.get(key) === lockId) {
        this.locks.delete(key);
      }
    };
  }

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
    const releaseLock = this.acquireLock(key);
    try {
      const current = this.store.get(key);

      if (current === undefined) {
        if (expectedValue === "" || expectedValue === null || expectedValue === undefined) {
          this.store.set(key, {
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
        return {
          success: false,
        };
      }

      if (current.value !== expectedValue) {
        return {
          success: false,
          currentValue: current.value,
          currentVersion: current.version,
        };
      }

      const newVersion = current.version + 1;
      this.store.set(key, {
        value: newValue,
        version: newVersion,
        updatedAt: new Date(),
      });

      return {
        success: true,
        currentValue: newValue,
        currentVersion: newVersion,
      };
    } finally {
      releaseLock();
    }
  }

  public compareAndSet(key: string, expectedVersion: number, newValue: string): CasResult {
    const releaseLock = this.acquireLock(key);
    try {
      const current = this.store.get(key);

      if (current === undefined) {
        if (expectedVersion === 0) {
          this.store.set(key, {
            value: newValue,
            version: 1,
            updatedAt: new Date(),
          });
          return { success: true, currentValue: newValue, currentVersion: 1 };
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

      const newVersion = current.version + 1;
      this.store.set(key, {
        value: newValue,
        version: newVersion,
        updatedAt: new Date(),
      });

      return {
        success: true,
        currentValue: newValue,
        currentVersion: newVersion,
      };
    } finally {
      releaseLock();
    }
  }
}

/**
 * CAS Service providing optimistic concurrency control via compare-and-swap operations.
 *
 * Implements:
 * - Value-based CAS: compareAndSwap(key, expectedValue, newValue)
 * - Version-based CAS: compareAndSet(key, expectedVersion, newValue)
 * - Read operations: getValue(key), getVersion(key)
 */
export class CasService {
  public constructor(private readonly repository: CasRepository = new InMemoryCasRepository()) {}

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
    return this.repository.compareAndSwap(key, expectedValue, newValue);
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
    return this.repository.compareAndSet(key, expectedVersion, newValue);
  }

  /**
   * Reads the current value for a key.
   *
   * @param key - The key to read
   * @returns The current value or undefined if not found
   */
  public getValue(key: string): string | undefined {
    return this.repository.get(key)?.value;
  }

  /**
   * Reads the current version for a key.
   *
   * @param key - The key to read
   * @returns The current version or undefined if not found
   */
  public getVersion(key: string): number | undefined {
    return this.repository.get(key)?.version;
  }

  /**
   * Sets a value directly (without CAS), initializing version to 1.
   *
   * @param key - The key to set
   * @param value - The value to set
   */
  public setValue(key: string, value: string): void {
    const existing = this.repository.get(key);
    const currentVersion = existing?.version ?? 0;
    this.repository.set(key, {
      value,
      version: currentVersion + 1,
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
    return this.repository.delete(key);
  }

  /**
   * Checks if a key exists in the store.
   *
   * @param key - The key to check
   * @returns true if the key exists
   */
  public has(key: string): boolean {
    return this.repository.has(key);
  }
}

export function createInMemoryCasService(): CasService {
  return new CasService(new InMemoryCasRepository());
}
