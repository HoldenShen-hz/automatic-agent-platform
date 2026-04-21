/**
 * Prompt Cache Policy
 *
 * Specialized cache policies for prompt-related namespaces.
 */
export const PROMPT_CACHE_POLICIES = {
    'prompt.prefix': {
        enabled: true,
        scope: 'persistent',
        ttlMs: 24 * 60 * 60 * 1000, // 24 hours
        version: 'v1',
        maxPayloadBytes: 512 * 1024,
        tags: ['prompt:prefix'],
    },
    'prompt.full': {
        enabled: true,
        scope: 'session',
        ttlMs: 30 * 60 * 1000, // 30 minutes
        version: 'v1',
        maxPayloadBytes: 512 * 1024,
        tags: ['prompt:full'],
    },
    'prompt.static': {
        enabled: true,
        scope: 'persistent',
        ttlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
        version: 'v1',
        maxPayloadBytes: 1024 * 1024,
        tags: ['prompt:static'],
    },
};
//# sourceMappingURL=prompt-cache-policy.js.map