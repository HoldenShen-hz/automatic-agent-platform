export class UserMemoryStore {
    entriesByUserId = new Map();
    upsert(userId, memory, promotedAt = new Date().toISOString()) {
        const userEntries = this.entriesByUserId.get(userId) ?? new Map();
        const entry = {
            userId,
            memory,
            promotedAt,
        };
        userEntries.set(memory.id, entry);
        this.entriesByUserId.set(userId, userEntries);
        return entry;
    }
    list(userId) {
        return [...(this.entriesByUserId.get(userId)?.values() ?? [])];
    }
    get(userId, memoryId) {
        return this.entriesByUserId.get(userId)?.get(memoryId) ?? null;
    }
}
//# sourceMappingURL=user-memory-store.js.map