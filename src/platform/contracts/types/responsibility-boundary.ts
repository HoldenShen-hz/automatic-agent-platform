/**
 * ResponsibilityBoundary Type
 *
 * Defines the responsibility boundaries between human operators and AI agents.
 * Used for accountability tracking and audit trail purposes.
 *
 * @see docs_zh/contracts/responsibility_boundary_contract.md
 */

import { newId, nowIso } from "./ids.js";

/**
 * Responsibility boundary types
 */
export type ResponsibilityBoundaryType =
  | "human_in_the_loop"
  | "ai_boundary"
  | "system_boundary"
  | "organizational_boundary";

export type ResponsibilityBoundaryMode =
  | "advisory_only"
  | "human_accountable";

/**
 * Actor type in the responsibility chain
 */
export type ResponsibilityActorType =
  | "human_operator"
  | "ai_agent"
  | "system_service"
  | "external_system";

/**
 * Action that can be taken at a responsibility boundary
 */
export type BoundaryAction =
  | "approve"
  | "reject"
  | "override"
  | "delegate"
  | "escalate"
  | "inspect"
  | "patch"
  | "takeover"
  | "resume";

/**
 * A responsibility boundary defines where human responsibility begins
 * for a task, workflow, or decision.
 */
export interface ResponsibilityBoundary {
  readonly boundaryId: string;
  readonly taskId: string;
  readonly executionId: string | null;
  readonly boundaryType: ResponsibilityBoundaryType;
  readonly operatingMode: ResponsibilityBoundaryMode;
  readonly stageRef: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly description: string;
  readonly constraints: readonly string[];
  readonly requiresHumanReview: boolean;
  readonly autoEscalateAfter: string | null;
}

/**
 * Record of responsibility transfer across a boundary
 */
export interface ResponsibilityTransfer {
  readonly transferId: string;
  readonly boundaryId: string;
  readonly fromActor: string;
  readonly fromActorType: ResponsibilityActorType;
  readonly toActor: string;
  readonly toActorType: ResponsibilityActorType;
  readonly action: BoundaryAction;
  readonly reason: string;
  readonly timestamp: string;
  readonly acknowledgedAt: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Accountability record for tracking who is responsible for what
 */
export interface AccountabilityRecord {
  readonly recordId: string;
  readonly boundaryId: string;
  readonly taskId: string;
  readonly executionId: string | null;
  readonly responsibleActorId: string;
  readonly responsibleActorType: ResponsibilityActorType;
  readonly responsibilityLevel: "primary" | "secondary" | "oversight";
  readonly assignedAt: string;
  readonly releasedAt: string | null;
  readonly releaseReason: string | null;
}

/**
 * Service for managing responsibility boundaries
 */
export class ResponsibilityBoundaryService {
  private readonly boundaries = new Map<string, ResponsibilityBoundary>();
  private readonly transfers = new Map<string, ResponsibilityTransfer>();
  private readonly accountability = new Map<string, AccountabilityRecord>();

  /**
   * Create a new responsibility boundary
   */
  public createBoundary(input: {
    taskId: string;
    executionId?: string | null;
    boundaryType: ResponsibilityBoundaryType;
    operatingMode?: ResponsibilityBoundaryMode;
    stageRef: string;
    createdBy: string;
    description: string;
    constraints?: readonly string[];
    requiresHumanReview?: boolean;
    autoEscalateAfter?: string | null;
  }): ResponsibilityBoundary {
    const boundary: ResponsibilityBoundary = {
      boundaryId: newId("resp_boundary"),
      taskId: input.taskId,
      executionId: input.executionId ?? null,
      boundaryType: input.boundaryType,
      operatingMode: input.operatingMode ?? "human_accountable",
      stageRef: input.stageRef,
      createdAt: nowIso(),
      createdBy: input.createdBy,
      description: input.description,
      constraints: input.constraints ?? [],
      requiresHumanReview: input.requiresHumanReview ?? true,
      autoEscalateAfter: input.autoEscalateAfter ?? null,
    };

    this.boundaries.set(boundary.boundaryId, boundary);
    return boundary;
  }

  /**
   * Record a responsibility transfer across a boundary
   */
  public recordTransfer(input: {
    boundaryId: string;
    fromActor: string;
    fromActorType: ResponsibilityActorType;
    toActor: string;
    toActorType: ResponsibilityActorType;
    action: BoundaryAction;
    reason: string;
    metadata?: Readonly<Record<string, unknown>>;
  }): ResponsibilityTransfer {
    const boundary = this.boundaries.get(input.boundaryId);
    if (!boundary) {
      throw new Error(`responsibility_boundary.not_found:${input.boundaryId}`);
    }
    this.assertBoundaryActionAllowed(boundary, input.action, input.toActorType);

    const transfer: ResponsibilityTransfer = {
      transferId: newId("resp_transfer"),
      boundaryId: input.boundaryId,
      fromActor: input.fromActor,
      fromActorType: input.fromActorType,
      toActor: input.toActor,
      toActorType: input.toActorType,
      action: input.action,
      reason: input.reason,
      timestamp: nowIso(),
      acknowledgedAt: null,
      metadata: input.metadata ?? {},
    };

    this.transfers.set(transfer.transferId, transfer);
    return transfer;
  }

  /**
   * Acknowledge a responsibility transfer
   */
  public acknowledgeTransfer(transferId: string, acknowledgedBy: string): ResponsibilityTransfer {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      throw new Error(`responsibility_transfer.not_found:${transferId}`);
    }

    const acknowledged: ResponsibilityTransfer = {
      ...transfer,
      acknowledgedAt: nowIso(),
      metadata: { ...transfer.metadata, acknowledgedBy },
    };

    this.transfers.set(transferId, acknowledged);
    return acknowledged;
  }

  /**
   * Assign accountability for a boundary
   */
  public assignAccountability(input: {
    boundaryId: string;
    taskId: string;
    executionId?: string | null;
    responsibleActorId: string;
    responsibleActorType: ResponsibilityActorType;
    responsibilityLevel: "primary" | "secondary" | "oversight";
  }): AccountabilityRecord {
    const record: AccountabilityRecord = {
      recordId: newId("accountability"),
      boundaryId: input.boundaryId,
      taskId: input.taskId,
      executionId: input.executionId ?? null,
      responsibleActorId: input.responsibleActorId,
      responsibleActorType: input.responsibleActorType,
      responsibilityLevel: input.responsibilityLevel,
      assignedAt: nowIso(),
      releasedAt: null,
      releaseReason: null,
    };

    this.accountability.set(record.recordId, record);
    return record;
  }

  /**
   * Release accountability
   */
  public releaseAccountability(
    recordId: string,
    reason: string,
  ): AccountabilityRecord {
    const record = this.accountability.get(recordId);
    if (!record) {
      throw new Error(`accountability_record.not_found:${recordId}`);
    }

    const released: AccountabilityRecord = {
      ...record,
      releasedAt: nowIso(),
      releaseReason: reason,
    };

    this.accountability.set(recordId, released);
    return released;
  }

  /**
   * Get boundary by ID
   */
  public getBoundary(boundaryId: string): ResponsibilityBoundary | null {
    return this.boundaries.get(boundaryId) ?? null;
  }

  /**
   * Get all boundaries for a task
   */
  public getBoundariesForTask(taskId: string): readonly ResponsibilityBoundary[] {
    return [...this.boundaries.values()].filter((b) => b.taskId === taskId);
  }

  /**
   * Get all transfers for a boundary
   */
  public getTransfersForBoundary(boundaryId: string): readonly ResponsibilityTransfer[] {
    return [...this.transfers.values()].filter((t) => t.boundaryId === boundaryId);
  }

  /**
   * Get accountability records for a task
   */
  public getAccountabilityForTask(taskId: string): readonly AccountabilityRecord[] {
    return [...this.accountability.values()].filter((r) => r.taskId === taskId);
  }

  /**
   * Check if a boundary requires human review
   */
  public requiresHumanReview(boundaryId: string): boolean {
    const boundary = this.boundaries.get(boundaryId);
    return boundary?.requiresHumanReview ?? false;
  }

  public assertActionAllowed(
    boundaryId: string,
    action: BoundaryAction,
    actorType: ResponsibilityActorType,
  ): void {
    const boundary = this.boundaries.get(boundaryId);
    if (!boundary) {
      throw new Error(`responsibility_boundary.not_found:${boundaryId}`);
    }
    this.assertBoundaryActionAllowed(boundary, action, actorType);
  }

  private assertBoundaryActionAllowed(
    boundary: ResponsibilityBoundary,
    action: BoundaryAction,
    actorType: ResponsibilityActorType,
  ): void {
    const mutatingActions = new Set<BoundaryAction>(["approve", "reject", "override", "patch", "takeover", "resume", "delegate"]);
    if (boundary.operatingMode === "advisory_only" && mutatingActions.has(action)) {
      throw new Error(`responsibility_boundary.advisory_only_blocks_action:${action}`);
    }
    const humanOnlyActions = new Set<BoundaryAction>(["approve", "reject", "override", "patch", "takeover", "resume"]);
    if (boundary.operatingMode === "human_accountable" && humanOnlyActions.has(action) && actorType !== "human_operator") {
      throw new Error(`responsibility_boundary.human_accountable_requires_human:${action}`);
    }
  }
}

/**
 * Singleton instance
 */
let GLOBAL_RESPONSIBILITY_BOUNDARY_SERVICE: ResponsibilityBoundaryService | null = null;

export function getResponsibilityBoundaryService(): ResponsibilityBoundaryService {
  if (!GLOBAL_RESPONSIBILITY_BOUNDARY_SERVICE) {
    GLOBAL_RESPONSIBILITY_BOUNDARY_SERVICE = new ResponsibilityBoundaryService();
  }
  return GLOBAL_RESPONSIBILITY_BOUNDARY_SERVICE;
}

export function resetResponsibilityBoundaryService(): void {
  GLOBAL_RESPONSIBILITY_BOUNDARY_SERVICE = null;
}
