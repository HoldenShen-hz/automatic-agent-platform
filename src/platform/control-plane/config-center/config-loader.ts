/**
 * Configuration Loader
 *
 * Loads configuration from various sources including environment variables,
 * files, and remote services. Supports caching and refresh cycles.
 */

import { readTrimmedEnv } from "./runtime-env.js";
import { ValidationError } from "../../contracts/errors.js";

/**
 * Configuration source priority.
 */
export enum ConfigSourcePriority {
  /** Default configuration */
  DEFAULT = 0,
  /** Environment variable */
  ENVIRONMENT = 50,
  /** File-based configuration */
  FILE = 40,
  /** Remote/service configuration */
  REMOTE = 60,
}

/**
 * Represents a configuration source.
 */
export interface ConfigSource {
  name: string;
  priority: ConfigSourcePriority;
  load(): Promise<Record<string, unknown>>;
}

/**
 * Options for ConfigLoader.
 */
export interface ConfigLoaderOptions {
  /** Optional sources to load configuration from */
  sources?: ConfigSource[];
  /** Whether to enable caching */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
}

/**
 * Cached configuration entry.
 */
interface CachedConfig {
  value: Record<string, unknown>;
  loadedAt: number;
}

/**
 * Configuration loader that aggregates and merges config from multiple sources.
 *
 * Sources are loaded in priority order (lowest first) and merged with
 * higher priority sources overriding lower priority ones.
 */
export class ConfigLoader {
  private readonly sources: ConfigSource[];
  private readonly enableCache: boolean;
  private readonly cacheTtlMs: number;
  private cache: Map<string, CachedConfig>;

  public constructor(options: ConfigLoaderOptions = {}) {
    this.sources = options.sources ?? [];
    this.enableCache = options.enableCache ?? true;
    this.cacheTtlMs = options.cacheTtlMs ?? 60000;
    this.cache = new Map();
  }

  /**
   * Adds a configuration source.
   *
   * @param source - The source to add
   */
  public addSource(source: ConfigSource): void {
    this.sources.push(source);
    // Sort by priority
    this.sources.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Loads configuration from all sources and merges them.
   *
   * @returns Merged configuration object
   */
  public async loadConfig(): Promise<Record<string, unknown>> {
    const merged: Record<string, unknown> = {};

    for (const source of this.sources) {
      const cached = this.getCached(source.name);
      let sourceConfig: Record<string, unknown>;

      if (cached) {
        sourceConfig = cached;
      } else {
        sourceConfig = await source.load();
        if (this.enableCache) {
          this.setCache(source.name, sourceConfig);
        }
      }

      // Merge with priority (later sources override earlier)
      Object.assign(merged, sourceConfig);
    }

    return merged;
  }

  /**
   * Loads configuration synchronously from environment variables.
   *
   * @param env - Process environment
   * @param mappings - Key mappings from env var to config key
   * @returns Configuration object
   */
  public loadFromEnv(
    env: NodeJS.ProcessEnv,
    mappings: Record<string, string>,
  ): Record<string, unknown> {
    const config: Record<string, unknown> = {};

    for (const [configKey, envKey] of Object.entries(mappings)) {
      const value = readTrimmedEnv(env, envKey);
      if (value != null) {
        config[configKey] = value;
      }
    }

    return config;
  }

  /**
   * Clears the configuration cache.
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidates cache for a specific source.
   *
   * @param sourceName - Name of the source to invalidate
   */
  public invalidateCache(sourceName: string): void {
    this.cache.delete(sourceName);
  }

  /**
   * Checks if a cached config is still valid.
   *
   * @param sourceName - Name of the source
   * @returns True if cached and not expired
   */
  public isCacheValid(sourceName: string): boolean {
    const cached = this.cache.get(sourceName);
    if (!cached) return false;
    return Date.now() - cached.loadedAt < this.cacheTtlMs;
  }

  private getCached(sourceName: string): Record<string, unknown> | null {
    if (!this.enableCache) return null;
    if (!this.isCacheValid(sourceName)) return null;
    return this.cache.get(sourceName)?.value ?? null;
  }

  private setCache(sourceName: string, value: Record<string, unknown>): void {
    this.cache.set(sourceName, {
      value,
      loadedAt: Date.now(),
    });
  }
}

/**
 * Environment-based configuration source.
 */
export class EnvironmentConfigSource implements ConfigSource {
  public readonly name = "environment";
  public readonly priority = ConfigSourcePriority.ENVIRONMENT;
  private readonly prefix: string;
  private readonly env: NodeJS.ProcessEnv;

  public constructor(prefix: string = "AA_", env: NodeJS.ProcessEnv = process.env) {
    this.prefix = prefix;
    this.env = env;
  }

  public async load(): Promise<Record<string, unknown>> {
    const config: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(this.env)) {
      if (key.startsWith(this.prefix) && value != null) {
        // Remove prefix and convert to camelCase
        const configKey = key
          .slice(this.prefix.length)
          .toLowerCase()
          .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        config[configKey] = value;
      }
    }

    return config;
  }
}

/**
 * Default configuration source.
 */
export class DefaultConfigSource implements ConfigSource {
  public readonly name: string;
  public readonly priority = ConfigSourcePriority.DEFAULT;
  private readonly defaults: Record<string, unknown>;

  public constructor(name: string, defaults: Record<string, unknown>) {
    this.name = name;
    this.defaults = defaults;
  }

  public async load(): Promise<Record<string, unknown>> {
    return { ...this.defaults };
  }
}