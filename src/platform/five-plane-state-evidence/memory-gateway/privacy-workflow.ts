import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { ErasurePlanningService, type ErasurePlan } from "../../compliance/erasure/index.js";
import type { MemoryRecord } from "../../contracts/types/domain.js";
import type { MemoryService } from "../memory/memory-service.js";

export interface MemoryExportRequest {
  tenantId: string;
  requestedBy: string;
  memoryIds: readonly string[];
  includeRevoked?: boolean;
}

export interface MemoryExportBundle {
  exportId: string;
  tenantId: string;
  requestedBy: string;
  createdAt: string;
  memoryIds: string[];
  exportedMemories: Array<{
    memoryId: string;
    scope: string;
    layer: MemoryRecord["memoryLayer"];
    classification: string;
    createdAt: string;
    contentJson: string;
    status: MemoryRecord["status"];
    revokedAt: string | null;
  }>;
}

export interface MemoryDeleteWorkflowRequest {
  tenantId: string;
  requestedBy: string;
  subjectRef: string;
  memoryIds: readonly string[];
  containsPii?: boolean;
  legalHold?: boolean;
  backupCopy?: boolean;
  slaHours?: number;
}

export interface MemoryDeleteWorkflowResult {
  plan: ErasurePlan;
  memoryIds: string[];
}

export interface MemoryRevokeWorkflowResult {
  workflowId: string;
  tenantId: string;
  requestedBy: string;
  memoryIds: string[];
  revokedAt: string;
  reason: string;
}

export class MemoryPrivacyWorkflowService {
  private readonly erasurePlanning = new ErasurePlanningService();

  public constructor(private readonly memoryService: MemoryService) {}

  public exportMemories(input: MemoryExportRequest): MemoryExportBundle {
    const exportedMemories = input.memoryIds
      .map((memoryId) => this.memoryService.getStore().memory.getMemory(memoryId))
      .filter((record): record is MemoryRecord => record != null)
      .filter((record) => input.includeRevoked === true || record.revokedAt == null);

    if (exportedMemories.length === 0) {
      throw new ValidationError("memory.export_not_found", "memory.export_not_found");
    }

    return {
      exportId: newId("mem_export"),
      tenantId: input.tenantId,
      requestedBy: input.requestedBy,
      createdAt: nowIso(),
      memoryIds: exportedMemories.map((record) => record.id),
      exportedMemories: exportedMemories.map((record) => ({
        memoryId: record.id,
        scope: record.scope,
        layer: record.memoryLayer,
        classification: record.classification,
        createdAt: record.createdAt,
        contentJson: record.contentJson,
        status: record.status,
        revokedAt: record.revokedAt,
      })),
    };
  }

  public createDeleteWorkflow(input: MemoryDeleteWorkflowRequest): MemoryDeleteWorkflowResult {
    const existingMemoryIds = input.memoryIds
      .filter((memoryId) => this.memoryService.getStore().memory.getMemory(memoryId) != null);
    if (existingMemoryIds.length === 0) {
      throw new ValidationError("memory.delete_not_found", "memory.delete_not_found");
    }
    return {
      plan: this.erasurePlanning.createPlan({
        subjectRef: input.subjectRef,
        requestedBy: input.requestedBy,
        slaHours: input.slaHours ?? 72,
        targets: existingMemoryIds.map((memoryId) => ({
          targetRef: memoryId,
          targetKind: "memory" as const,
          containsPii: input.containsPii ?? true,
          ...(input.legalHold != null ? { legalHold: input.legalHold } : {}),
          ...(input.backupCopy != null ? { backupCopy: input.backupCopy } : {}),
        })),
      }),
      memoryIds: existingMemoryIds,
    };
  }

  public revokeMemories(memoryIds: readonly string[], requestedBy: string, tenantId: string, reason: string): MemoryRevokeWorkflowResult {
    const revokedAt = nowIso();
    const revokedMemoryIds: string[] = [];
    for (const memoryId of memoryIds) {
      const revoked = this.memoryService.revoke(memoryId, reason, revokedAt);
      if (revoked != null) {
        revokedMemoryIds.push(memoryId);
      }
    }
    if (revokedMemoryIds.length === 0) {
      throw new ValidationError("memory.revoke_not_found", "memory.revoke_not_found");
    }
    return {
      workflowId: newId("mem_privacy"),
      tenantId,
      requestedBy,
      memoryIds: revokedMemoryIds,
      revokedAt,
      reason,
    };
  }
}
