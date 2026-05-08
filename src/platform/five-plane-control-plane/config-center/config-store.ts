/**
 * Configuration Store
 *
 * Provides a centralized store for configuration values with
 * support for snapshots, rollback, and change tracking.
 */

import { ValidationError } from "../../contracts/errors.js";

/**
 * Represents a configuration entry with metadata.
 */
export interface ConfigEntry<T = unknown> {
  key: string;
  value: T;
  version: number;
  updatedAt: string;
  source: string;
}

/**
 * Snapshot of the entire config store state.
 */
export interface ConfigStoreSnapshot {
  entries: Record<string, ConfigEntry>;
  version: number;
  createdAt: string;
}

/**
 * Options for creating a ConfigStore.
 */
export interface ConfigStoreOptions {
  /** Initial entries to populate the store */
  initialEntries?: Record<string, unknown>;
  /** Source identifier for entries */
  source?: string;
}

/**
 * Configuration store for managing key-value configuration.
 *
 * Supports:
 * - Basic get/set operations
 * - Version tracking
 * - Snapshots and rollback
 * - Change event emission
 */
export class ConfigStore {
  private readonly entries: Map<string, ConfigEntry>;
  private version: number;
  private readonly source: string;
  private changeListeners: Array<(key: string, oldValue: unknown, newValue: unknown) => void>;

  public constructor(options: ConfigStoreOptions = {}) {
    this.entries = new Map();
    this.version = 0;
    this.source = options.source ?? "default";
    this.changeListeners = [];

    if (options.initialEntries) {
      for (const [key, value] of Object.entries(options.initialEntries)) {
        this.set(key, value);
      }
    }
  }

  /**
   * Gets a configuration value by key.
   *
   * @param key - The configuration key
   * @returns The configuration value, or undefined if not found
   */
  public get<T = unknown>(key: string): T | undefined {
    const entry = this.entries.get(key);
    return entry?.value as T | undefined;
  }

  /**
   * Gets a configuration value by key, throwing if not found.
   *
   * @param key - The configuration key
   * @returns The configuration value
   * @throws ValidationError if key is not found
   */
  public getRequired<T = unknown>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined) {
      throw new ValidationError(`config_key_not_found:${key}`, `Configuration key '${key}' is not found`);
    }
    return value;
  }

  /**
   * Sets a configuration value.
   *
   * @param key - The configuration key
   * @param value - The configuration value
   */
  public set(key: string, value: unknown): void {
    const oldEntry = this.entries.get(key);
    const now = new Date().toISOString();

    const entry: ConfigEntry = {
      key,
      value: value as unknown,
      version: (oldEntry?.version ?? this.version) + 1,
      updatedAt: now,
      source: this.source,
    };

    this.entries.set(key, entry);
    this.version++;

    // Notify listeners
    if (oldEntry?.value !== value) {
      for (const listener of this.changeListeners) {
        listener(key, oldEntry?.value, value);
      }
    }
  }

  /**
   * Checks if a key exists in the store.
   *
   * @param key - The configuration key
   * @returns True if the key exists
   */
  public has(key: string): boolean {
    return this.entries.has(key);
  }

  /**
   * Deletes a configuration key.
   *
   * @param key - The configuration key
   * @returns True if the key was deleted
   */
  public delete(key: string): boolean {
    const result = this.entries.delete(key);
    if (result) {
      this.version++;
    }
    return result;
  }

  /**
   * Gets all configuration entries as a plain object.
   *
   * @returns Object with all configuration key-value pairs
   */
  public toObject(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of this.entries) {
      result[key] = entry.value;
    }
    return result;
  }

  /**
   * Creates a snapshot of the current store state.
   *
   * @returns Snapshot of the store
   */
  public snapshot(): ConfigStoreSnapshot {
    const entries: Record<string, ConfigEntry> = {};
    for (const [key, entry] of this.entries) {
      entries[key] = { ...entry };
    }
    return {
      entries,
      version: this.version,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Restores the store from a snapshot.
   *
   * @param snapshot - The snapshot to restore from
   * @throws ValidationError if snapshot is invalid
   */
  public restore(snapshot: ConfigStoreSnapshot): void {
    if (!snapshot || !snapshot.entries || !snapshot.createdAt) {
      throw new ValidationError("invalid_snapshot", "Snapshot is invalid or empty");
    }

    this.entries.clear();
    for (const [key, entry] of Object.entries(snapshot.entries)) {
      this.entries.set(key, { ...entry });
    }
    this.version = snapshot.version;
  }

  /**
   * Merges another object's values into the store.
   *
   * @param values - Object with values to merge
   */
  public merge(values: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(values)) {
      this.set(key, value);
    }
  }

  /**
   * Clears all entries from the store.
   */
  public clear(): void {
    this.entries.clear();
    this.version++;
  }

  /**
   * Gets the current version of the store.
   *
   * @returns The version number
   */
  public getVersion(): number {
    return this.version;
  }

  /**
   * Registers a change listener.
   *
   * @param listener - Callback function invoked on changes
   */
  public onChange(listener: (key: string, oldValue: unknown, newValue: unknown) => void): void {
    this.changeListeners.push(listener);
  }

  /**
   * Removes a change listener.
   *
   * @param listener - The listener to remove
   */
  public offChange(listener: (key: string, oldValue: unknown, newValue: unknown) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index >= 0) {
      this.changeListeners.splice(index, 1);
    }
  }
}