import type { MemoryRecord } from "../../contracts/types/domain.js";
export interface UserMemoryEntry {
    userId: string;
    memory: MemoryRecord;
    promotedAt: string;
}
export declare class UserMemoryStore {
    private readonly entriesByUserId;
    upsert(userId: string, memory: MemoryRecord, promotedAt?: string): UserMemoryEntry;
    list(userId: string): UserMemoryEntry[];
    get(userId: string, memoryId: string): UserMemoryEntry | null;
}
