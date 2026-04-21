import { createHash } from "node:crypto";
export class ModelGatewayCacheService {
    entries = new Map();
    buildCacheKey(input) {
        const normalizedPrompt = JSON.stringify(input.messages.map((message) => ({ role: message.role, content: message.content.trim() })));
        return createHash("sha256")
            .update(JSON.stringify({
            tenantId: input.tenantId ?? null,
            model: input.model,
            routeClass: input.routeClass,
            prompt: normalizedPrompt,
        }))
            .digest("hex");
    }
    put(input) {
        const createdAt = input.createdAt ?? new Date().toISOString();
        const expiresAt = input.ttlMs == null
            ? null
            : new Date(new Date(createdAt).getTime() + input.ttlMs).toISOString();
        const entry = {
            cacheKey: input.cacheKey,
            tenantId: input.tenantId ?? null,
            model: input.model,
            routeClass: input.routeClass,
            value: input.value,
            createdAt,
            expiresAt,
        };
        this.entries.set(entry.cacheKey, entry);
        return entry;
    }
    get(cacheKey, now = new Date().toISOString()) {
        const entry = this.entries.get(cacheKey);
        if (entry == null) {
            return null;
        }
        if (entry.expiresAt != null && entry.expiresAt <= now) {
            this.entries.delete(cacheKey);
            return null;
        }
        return entry;
    }
    invalidate(cacheKey) {
        return this.entries.delete(cacheKey);
    }
    listEntries() {
        return [...this.entries.values()];
    }
}
//# sourceMappingURL=index.js.map