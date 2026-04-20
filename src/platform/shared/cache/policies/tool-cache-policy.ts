/**
 * Tool Cache Policy
 *
 * Specialized cache policies for tool-related namespaces.
 */

import type { CachePolicy } from '../cache-types.js';

export const TOOL_CACHE_POLICIES: Record<string, CachePolicy> = {
  'tool.read': {
    enabled: true,
    scope: 'session',
    ttlMs: 5 * 60 * 1000,
    version: 'v1',
    maxPayloadBytes: 256 * 1024,
    tags: ['tool:read'],
  },
  'tool.glob': {
    enabled: true,
    scope: 'session',
    ttlMs: 5 * 60 * 1000,
    version: 'v1',
    maxPayloadBytes: 256 * 1024,
    tags: ['tool:glob'],
  },
  'tool.grep': {
    enabled: true,
    scope: 'session',
    ttlMs: 3 * 60 * 1000,
    version: 'v1',
    maxPayloadBytes: 256 * 1024,
    tags: ['tool:grep'],
  },
  'tool.repo_map': {
    enabled: true,
    scope: 'persistent',
    ttlMs: 10 * 60 * 1000,
    version: 'v1',
    maxPayloadBytes: 1024 * 1024,
    tags: ['tool:repo_map'],
  },
  'tool.diagnostics': {
    enabled: true,
    scope: 'session',
    ttlMs: 5 * 60 * 1000,
    version: 'v1',
    maxPayloadBytes: 256 * 1024,
    tags: ['tool:diagnostics'],
  },
  'tool.web_fetch': {
    enabled: true,
    scope: 'session',
    ttlMs: 10 * 60 * 1000,
    version: 'v1',
    maxPayloadBytes: 512 * 1024,
    tags: ['tool:web_fetch'],
  },
};
