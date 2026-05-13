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
 * ## Concurrency Control
 *
 * - **Distributed**: When a DistributedLockAdapter is provided, uses it to acquire a
 *   named lock ("cas:{key}") before read-check-write, ensuring atomicity across
 *   multiple processes/nodes.
 * - **In-process**: When only a repository is provided, uses the repository's own
 *   locking (e.g., SQLite BEGIN IMMEDIATE transaction). Falls back to in-memory
 *   Map with a simple counter-based lock for single-process atomicity only.
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

interface CasDistributedLockAdapter {
  acquire(input: { lockKey: string; owner: string; ttlMs?: number }): { acquired: boolean };
  release(lockKey: string, owner: string): boolean;
}

class InMemoryCasRepository implements CasRepository {
  private readonly store = new Map<string, CasRecord>();
  private readonly locks = new Map<string, number>();
  private lockIdCounter = 0;

  /**
   * Acquires a lock for a specific key using a simple in-memory locking mechanism.
   * Uses a counter-based lock acquisition that's suitable for single-process concurrency.
   * NOTE: This does NOT provide distributed concurrency control.
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
 * Repository wrapper that adds distributed locking around an existing repository.
 * Acquires a named lock before read-check-write to ensure atomicity across
 * multiple processes/nodes.
 */
class DistributedLockCasRepository implements CasRepository {
  public constructor(
    private readonly inner: CasRepository,
    private readonly lockAdapter: CasDistributedLockAdapter,
  ) {}

  public get(key: string): CasRecord | undefined {
    return this.inner.get(key);
  }

  public set(key: string, record: CasRecord): void {
    return this.inner.set(key, record);
  }

  public delete(key: string): boolean {
    return this.inner.delete(key);
  }

  public has(key: string): boolean {
    return this.inner.has(key);
  }

  public compareAndSwap(key: string, expectedValue: string, newValue: string): CasResult {
    const lockKey = `cas:${key}`;
    const owner = `cas-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Acquire distributed lock before read-check-write
    const result = this.lockAdapter.acquire({ lockKey, owner, ttlMs: 10_000 });
    if (!result.acquired) {
      // Could not acquire lock - treat as CAS failure
      const current = this.inner.get(key);
      const ret: CasResult = { success: false };
      if (current) {
        ret.currentValue = current.value;
        ret.currentVersion = current.version;
      }
      return ret;
    }

    try {
      // Perform CAS on inner repository while holding the lock
      return this.inner.compareAndSwap(key, expectedValue, newValue);
    } finally {
      this.lockAdapter.release(lockKey, owner);
    }
  }

  public compareAndSet(key: string, expectedVersion: number, newValue: string): CasResult {
    const lockKey = `cas:${key}`;
    const owner = `cas-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Acquire distributed lock before read-check-write
    const result = this.lockAdapter.acquire({ lockKey, owner, ttlMs: 10_000 });
    if (!result.acquired) {
      // Could not acquire lock - treat as CAS failure
      const current = this.inner.get(key);
      const ret: CasResult = { success: false };
      if (current) {
        ret.currentValue = current.value;
        ret.currentVersion = current.version;
      }
      return ret;
    }

    try {
      // Perform CAS on inner repository while holding the lock
      return this.inner.compareAndSet(key, expectedVersion, newValue);
    } finally {
      this.lockAdapter.release(lockKey, owner);
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
 *
 * When a DistributedLockAdapter is provided, all CAS operations are protected
 * by a distributed lock to ensure atomicity across multiple processes/nodes.
 */
export class CasService {
  public constructor(
    private readonly repository: CasRepository = new InMemoryCasRepository(),
    private readonly lockAdapter?: CasDistributedLockAdapter,
  ) {}

  /**
   * Performs an atomic compare-and-swap operation.
   *
   * Updates the value only if the current value matches the expected value.
   * When a DistributedLockAdapter is configured, acquires a distributed lock
   * before performing the read-check-write to ensure atomicity across processes.
   *
   * @param key - The key to update
   * @param expectedValue - The value expected to be current
   * @param newValue - The new value to set if expectedValue matches
   * @returns CasResult indicating success and current state
   */
  public compareAndSwap(key: string, expectedValue: string, newValue: string): CasResult {
    return this.getEffectiveRepository().compareAndSwap(key, expectedValue, newValue);
  }

  /**
   * Performs a version-based compare-and-set operation.
   *
   * Updates the value only if the current version matches the expected version.
   * When a DistributedLockAdapter is configured, acquires a distributed lock
   * before performing the read-check-write to ensure atomicity across processes.
   *
   * @param key - The key to update
   * @param expectedVersion - The version expected to be current
   * @param newValue - The new value to set if version matches
   * @returns CasResult indicating success and current state
   */
  public compareAndSet(key: string, expectedVersion: number, newValue: string): CasResult {
    return this.getEffectiveRepository().compareAndSet(key, expectedVersion, newValue);
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

  /**
   * Returns the repository wrapped with distributed locking if configured.
   */
  private getEffectiveRepository(): CasRepository {
    if (this.lockAdapter) {
      return new DistributedLockCasRepository(this.repository, this.lockAdapter);
    }
    return this.repository;
  }
}

export function createInMemoryCasService(): CasService {
  return new CasService(new InMemoryCasRepository());
}

/**
 * Creates a CAS service with distributed locking for multi-process concurrency.
 *
 * @param repository - The underlying repository (e.g., SqliteCasRepository)
 * @param lockAdapter - The distributed lock adapter (e.g., Redis, SQLite, PostgreSQL)
 */
export function createDistributedCasService(
  repository: CasRepository,
  lockAdapter: CasDistributedLockAdapter,
): CasService {
  return new CasService(repository, lockAdapter);
}
