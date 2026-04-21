export class ProjectMemoryStore {
    entriesByProjectId = new Map();
    upsert(projectId, memory, promotedAt = new Date().toISOString()) {
        const projectEntries = this.entriesByProjectId.get(projectId) ?? new Map();
        const entry = {
            projectId,
            memory,
            promotedAt,
        };
        projectEntries.set(memory.id, entry);
        this.entriesByProjectId.set(projectId, projectEntries);
        return entry;
    }
    list(projectId) {
        return [...(this.entriesByProjectId.get(projectId)?.values() ?? [])];
    }
    get(projectId, memoryId) {
        return this.entriesByProjectId.get(projectId)?.get(memoryId) ?? null;
    }
}
//# sourceMappingURL=project-memory-store.js.map