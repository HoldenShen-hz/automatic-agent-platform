/**
 * Cache Policy Definitions
 *
 * Default policies for each cache namespace including TTL, scope,
 * max payload size, and version settings.
 */
export const DEFAULT_CACHE_POLICIES = {
    'prompt.prefix': {
        enabled: true,
        scope: 'persistent',
        ttlMs: 24 * 60 * 60 * 1000, // 24 hours
        version: 'v1',
        maxPayloadBytes: 512 * 1024, // 512 KB
    },
    'prompt.full': {
        enabled: true,
        scope: 'session',
        ttlMs: 30 * 60 * 1000, // 30 minutes
        version: 'v1',
        maxPayloadBytes: 512 * 1024,
    },
    'tool.read': {
        enabled: true,
        scope: 'session',
        ttlMs: 5 * 60 * 1000, // 5 minutes
        version: 'v1',
        maxPayloadBytes: 256 * 1024, // 256 KB
    },
    'tool.glob': {
        enabled: true,
        scope: 'session',
        ttlMs: 5 * 60 * 1000,
        version: 'v1',
        maxPayloadBytes: 256 * 1024,
    },
    'tool.grep': {
        enabled: true,
        scope: 'session',
        ttlMs: 3 * 60 * 1000, // 3 minutes
        version: 'v1',
        maxPayloadBytes: 256 * 1024,
    },
    'tool.repo_map': {
        enabled: true,
        scope: 'persistent',
        ttlMs: 10 * 60 * 1000, // 10 minutes
        version: 'v1',
        maxPayloadBytes: 1024 * 1024, // 1 MB
    },
    'tool.diagnostics': {
        enabled: true,
        scope: 'session',
        ttlMs: 5 * 60 * 1000,
        version: 'v1',
        maxPayloadBytes: 256 * 1024,
    },
    'tool.web_fetch': {
        enabled: true,
        scope: 'session',
        ttlMs: 10 * 60 * 1000,
        version: 'v1',
        maxPayloadBytes: 512 * 1024,
    },
    'memory.summary': {
        enabled: true,
        scope: 'persistent',
        ttlMs: 24 * 60 * 60 * 1000, // 24 hours
        version: 'v1',
        maxPayloadBytes: 256 * 1024,
    },
    'memory.retrieval': {
        enabled: true,
        scope: 'session',
        ttlMs: 5 * 60 * 1000,
        version: 'v1',
        maxPayloadBytes: 256 * 1024,
    },
    'planner.plan': {
        enabled: true,
        scope: 'session',
        ttlMs: 15 * 60 * 1000, // 15 minutes
        version: 'v1',
        maxPayloadBytes: 256 * 1024,
    },
};
export function getPolicyForNamespace(namespace, override) {
    const base = DEFAULT_CACHE_POLICIES[namespace] ?? {
        enabled: false,
        scope: 'session',
        ttlMs: 0,
        version: 'v1',
        maxPayloadBytes: 0,
    };
    return { ...base, ...override };
}
export function isCacheableNamespace(namespace) {
    return DEFAULT_CACHE_POLICIES[namespace]?.enabled ?? false;
}
export function getTTLForNamespace(namespace) {
    return DEFAULT_CACHE_POLICIES[namespace]?.ttlMs ?? 0;
}
export function getScopeForNamespace(namespace) {
    return DEFAULT_CACHE_POLICIES[namespace]?.scope ?? 'session';
}
//# sourceMappingURL=cache-policy.js.map