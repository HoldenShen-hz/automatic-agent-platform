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
interface CasRecord {
  value: string;
  version: number;
  updatedAt: Date;
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
  // In-memory store for CAS records (key -> { value, version, updatedAt })
  private readonly store = new Map<string, CasRecord>();

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
    const current = this.store.get(key);

    if (current === undefined) {
      // Key doesn't exist - if expected value is empty/null, we can set it
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
      // Key doesn't exist and expected value doesn't match
      return {
        success: false,
      };
    }

    if (current.value !== expectedValue) {
      // Value doesn't match - CAS fails
      return {
        success: false,
        currentValue: current.value,
        currentVersion: current.version,
      };
    }

    // Value matches - perform swap
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
    const current = this.store.get(key);

    if (current === undefined) {
      // Key doesn't exist - only succeeds if expected version is 0
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
      // Version doesn't match - CAS fails
      return {
        success: false,
        currentValue: current.value,
        currentVersion: current.version,
      };
    }

    // Version matches - perform update
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
    const currentVersion = existing?.version ?? 0;
    this.store.set(key, {
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
