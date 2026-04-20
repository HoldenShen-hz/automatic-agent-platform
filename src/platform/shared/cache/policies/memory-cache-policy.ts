/**
 * Memory Cache Policy
 *
 * Specialized cache policies for memory-related namespaces.
 */

import type { CachePolicy } from '../cache-types.js';

export const MEMORY_CACHE_POLICIES: Record<string, CachePolicy> = {
  'memory.summary': {
    enabled: true,
    scope: 'persistent',
    ttlMs: 24 * 60 * 60 * 1000, // 24 hours
    version: 'v1',
    maxPayloadBytes: 256 * 1024,
    tags: ['memory:summary'],
  },
  'memory.retrieval': {
    enabled: true,
    scope: 'session',
    ttlMs: 5 * 60 * 1000, // 5 minutes
    version: 'v1',
    maxPayloadBytes: 256 * 1024,
    tags: ['memory:retrieval'],
  },
  'memory.compressed': {
    enabled: true,
    scope: 'persistent',
    ttlMs: 12 * 60 * 60 * 1000, // 12 hours
    version: 'v1',
    maxPayloadBytes: 512 * 1024,
    tags: ['memory:compressed'],
  },
};
