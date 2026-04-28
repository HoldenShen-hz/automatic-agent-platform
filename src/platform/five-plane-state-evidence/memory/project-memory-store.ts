import type { MemoryRecord } from "../../contracts/types/domain.js";

export interface ProjectMemoryEntry {
  projectId: string;
  memory: MemoryRecord;
  promotedAt: string;
}

export class ProjectMemoryStore {
  private readonly entriesByProjectId = new Map<string, Map<string, ProjectMemoryEntry>>();

  public upsert(projectId: string, memory: MemoryRecord, promotedAt: string = new Date().toISOString()): ProjectMemoryEntry {
    const projectEntries = this.entriesByProjectId.get(projectId) ?? new Map<string, ProjectMemoryEntry>();
    const entry: ProjectMemoryEntry = {
      projectId,
      memory,
      promotedAt,
    };
    projectEntries.set(memory.id, entry);
    this.entriesByProjectId.set(projectId, projectEntries);
    return entry;
  }

  public list(projectId: string): ProjectMemoryEntry[] {
    return [...(this.entriesByProjectId.get(projectId)?.values() ?? [])];
  }

  public get(projectId: string, memoryId: string): ProjectMemoryEntry | null {
    return this.entriesByProjectId.get(projectId)?.get(memoryId) ?? null;
  }
}
