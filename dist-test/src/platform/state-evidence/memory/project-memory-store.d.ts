import type { MemoryRecord } from "../../contracts/types/domain.js";
export interface ProjectMemoryEntry {
    projectId: string;
    memory: MemoryRecord;
    promotedAt: string;
}
export declare class ProjectMemoryStore {
    private readonly entriesByProjectId;
    upsert(projectId: string, memory: MemoryRecord, promotedAt?: string): ProjectMemoryEntry;
    list(projectId: string): ProjectMemoryEntry[];
    get(projectId: string, memoryId: string): ProjectMemoryEntry | null;
}
