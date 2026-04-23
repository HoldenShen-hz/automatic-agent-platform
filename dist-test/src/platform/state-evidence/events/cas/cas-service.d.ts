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
 * CAS Service providing optimistic concurrency control via compare-and-swap operations.
 *
 * Implements:
 * - Value-based CAS: compareAndSwap(key, expectedValue, newValue)
 * - Version-based CAS: compareAndSet(key, expectedVersion, newValue)
 * - Read operations: getValue(key), getVersion(key)
 */
export declare class CasService {
    private readonly store;
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
    compareAndSwap(key: string, expectedValue: string, newValue: string): CasResult;
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
    compareAndSet(key: string, expectedVersion: number, newValue: string): CasResult;
    /**
     * Reads the current value for a key.
     *
     * @param key - The key to read
     * @returns The current value or undefined if not found
     */
    getValue(key: string): string | undefined;
    /**
     * Reads the current version for a key.
     *
     * @param key - The key to read
     * @returns The current version or undefined if not found
     */
    getVersion(key: string): number | undefined;
    /**
     * Sets a value directly (without CAS), initializing version to 1.
     *
     * @param key - The key to set
     * @param value - The value to set
     */
    setValue(key: string, value: string): void;
    /**
     * Deletes a key from the store.
     *
     * @param key - The key to delete
     * @returns true if the key was deleted, false if it didn't exist
     */
    delete(key: string): boolean;
    /**
     * Checks if a key exists in the store.
     *
     * @param key - The key to check
     * @returns true if the key exists
     */
    has(key: string): boolean;
}
