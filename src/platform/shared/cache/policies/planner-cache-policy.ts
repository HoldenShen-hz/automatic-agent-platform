/**
 * Planner Cache Policy
 *
 * Specialized cache policies for planner-related namespaces.
 */

import type { CachePolicy } from '../cache-types.js';

export const PLANNER_CACHE_POLICIES: Record<string, CachePolicy> = {
  'planner.plan': {
    enabled: true,
    scope: 'session',
    ttlMs: 15 * 60 * 1000, // 15 minutes
    version: 'v1',
    maxPayloadBytes: 256 * 1024,
    tags: ['planner:plan'],
  },
  'planner.decomposition': {
    enabled: true,
    scope: 'session',
    ttlMs: 10 * 60 * 1000, // 10 minutes
    version: 'v1',
    maxPayloadBytes: 256 * 1024,
    tags: ['planner:decomposition'],
  },
  'planner.workflow': {
    enabled: true,
    scope: 'session',
    ttlMs: 15 * 60 * 1000,
    version: 'v1',
    maxPayloadBytes: 512 * 1024,
    tags: ['planner:workflow'],
  },
};
