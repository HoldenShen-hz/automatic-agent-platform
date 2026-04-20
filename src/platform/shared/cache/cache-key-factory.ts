/**
 * Cache Key Factory
 *
 * Creates deterministic cache keys from namespace, version,
 * and normalized input using stable hashing.
 */

import { stableHash } from './utils/stable-hash.js';

export class CacheKeyFactory {
  /**
   * Creates a cache key in the format: {namespace}:{version}:{fingerprint}
   */
  static create(namespace: string, version: string, normalizedInput: unknown): string {
    const fingerprint = stableHash(normalizedInput);
    return `${namespace}:${version}:${fingerprint}`;
  }

  /**
   * Extracts the fingerprint from a cache key.
   */
  static getFingerprint(key: string): string | null {
    const parts = key.split(':');
    if (parts.length < 3) return null;
    return parts.slice(2).join(':') ?? null;
  }

  /**
   * Extracts the version from a cache key.
   */
  static getVersion(key: string): string | null {
    const parts = key.split(':');
    if (parts.length < 2) return null;
    return parts[1] ?? null;
  }

  /**
   * Extracts the namespace from a cache key.
   */
  static getNamespace(key: string): string | null {
    const parts = key.split(':');
    if (parts.length < 1) return null;
    return parts[0] ?? null;
  }

  /**
   * Parses a cache key into its components.
   */
  static parse(key: string): { namespace: string; version: string; fingerprint: string } | null {
    const parts = key.split(':');
    if (parts.length < 3) return null;
    const namespace = parts[0];
    const version = parts[1];
    const fingerprint = parts.slice(2).join(':');
    if (namespace === undefined || version === undefined) return null;
    return { namespace, version, fingerprint };
  }
}
