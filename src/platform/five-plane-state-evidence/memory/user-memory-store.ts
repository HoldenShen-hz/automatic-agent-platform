import type { MemoryRecord } from "../../contracts/types/domain.js";

export interface UserMemoryEntry {
  userId: string;
  memory: MemoryRecord;
  promotedAt: string;
}

export class UserMemoryStore {
  private readonly entriesByUserId = new Map<string, Map<string, UserMemoryEntry>>();

  public upsert(userId: string, memory: MemoryRecord, promotedAt: string = new Date().toISOString()): UserMemoryEntry {
    const userEntries = this.entriesByUserId.get(userId) ?? new Map<string, UserMemoryEntry>();
    const entry: UserMemoryEntry = {
      userId,
      memory,
      promotedAt,
    };
    userEntries.set(memory.id, entry);
    this.entriesByUserId.set(userId, userEntries);
    return entry;
  }

  public list(userId: string): UserMemoryEntry[] {
    return [...(this.entriesByUserId.get(userId)?.values() ?? [])];
  }

  public get(userId: string, memoryId: string): UserMemoryEntry | null {
    return this.entriesByUserId.get(userId)?.get(memoryId) ?? null;
  }
}
