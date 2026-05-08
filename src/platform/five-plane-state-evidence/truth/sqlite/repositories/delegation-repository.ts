/**
 * Delegation Repository
 *
 * Data access layer for agent delegation tables.
 * Part of §26 storage layer implementation.
 */

import { newId, nowIso } from "../../../../contracts/types/ids.js";

export type DelegationStatus = "pending" | "pending_approval" | "discovery" | "bid" | "awarded" | "active" | "completed" | "failed" | "cancelled" | "expired" | "timed_out";

export interface DelegationRecord {
  delegationId: string;
  parentAgentId: string;
  childAgentId: string;
  delegationChain: readonly string[];
  status: DelegationStatus;
  depth: number;
  expiresAt: string | null;
  resultRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DelegationEventRecord {
  eventId: string;
  delegationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface DelegationRepository {
  create(input: CreateDelegationInput): Promise<DelegationRecord>;
  findById(delegationId: string): Promise<DelegationRecord | null>;
  findByParentAgentId(parentAgentId: string): Promise<DelegationRecord[]>;
  findByStatus(status: DelegationStatus): Promise<DelegationRecord[]>;
  findExpired(now: string): Promise<DelegationRecord[]>;
  updateStatus(delegationId: string, status: DelegationStatus): Promise<void>;
  complete(delegationId: string, resultRef: string): Promise<void>;
  fail(delegationId: string, error: string): Promise<void>;
  delete(delegationId: string): Promise<void>;
}

export interface CreateDelegationInput {
  delegationId?: string;
  parentAgentId: string;
  childAgentId: string;
  delegationChain: readonly string[];
  depth: number;
  expiresAt?: string;
  status?: DelegationStatus;
}

export interface DelegationEventRepository {
  create(input: CreateEventInput): Promise<DelegationEventRecord>;
  findByDelegationId(delegationId: string): Promise<DelegationEventRecord[]>;
  deleteByDelegationId(delegationId: string): Promise<void>;
}

export interface CreateEventInput {
  delegationId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * In-memory implementation of DelegationRepository.
 */
export class InMemoryDelegationRepository implements DelegationRepository {
  private readonly delegations = new Map<string, DelegationRecord>();

  public async create(input: CreateDelegationInput): Promise<DelegationRecord> {
    const delegationId = newId("delegation");
    const now = nowIso();

    const delegation: DelegationRecord = {
      delegationId,
      parentAgentId: input.parentAgentId,
      childAgentId: input.childAgentId,
      delegationChain: input.delegationChain,
      status: "pending",
      depth: input.depth,
      expiresAt: input.expiresAt ?? null,
      resultRef: null,
      createdAt: now,
      updatedAt: now,
    };

    this.delegations.set(delegationId, delegation);
    return delegation;
  }

  public async findById(delegationId: string): Promise<DelegationRecord | null> {
    return this.delegations.get(delegationId) ?? null;
  }

  public async findByParentAgentId(parentAgentId: string): Promise<DelegationRecord[]> {
    return [...this.delegations.values()].filter((d) => d.parentAgentId === parentAgentId);
  }

  public async findByStatus(status: DelegationStatus): Promise<DelegationRecord[]> {
    return [...this.delegations.values()].filter((d) => d.status === status);
  }

  public async findExpired(now: string): Promise<DelegationRecord[]> {
    return [...this.delegations.values()].filter(
      (d) => d.expiresAt !== null && d.expiresAt < now && (d.status === "pending" || d.status === "active"),
    );
  }

  public async updateStatus(delegationId: string, status: DelegationStatus): Promise<void> {
    const existing = this.delegations.get(delegationId);
    if (existing) {
      existing.status = status;
      existing.updatedAt = nowIso();
    }
  }

  public async complete(delegationId: string, resultRef: string): Promise<void> {
    const existing = this.delegations.get(delegationId);
    if (existing) {
      existing.status = "completed";
      existing.resultRef = resultRef;
      existing.updatedAt = nowIso();
    }
  }

  public async fail(delegationId: string, _error: string): Promise<void> {
    const existing = this.delegations.get(delegationId);
    if (existing) {
      existing.status = "failed";
      existing.updatedAt = nowIso();
    }
  }

  public async delete(delegationId: string): Promise<void> {
    this.delegations.delete(delegationId);
  }
}

/**
 * In-memory implementation of DelegationEventRepository.
 */
export class InMemoryDelegationEventRepository implements DelegationEventRepository {
  private readonly events = new Map<string, DelegationEventRecord[]>();

  public async create(input: CreateEventInput): Promise<DelegationEventRecord> {
    const eventId = newId("delegation_event");
    const now = nowIso();

    const event: DelegationEventRecord = {
      eventId,
      delegationId: input.delegationId,
      eventType: input.eventType,
      payload: input.payload,
      createdAt: now,
    };

    const existing = this.events.get(input.delegationId) ?? [];
    existing.push(event);
    this.events.set(input.delegationId, existing);

    return event;
  }

  public async findByDelegationId(delegationId: string): Promise<DelegationEventRecord[]> {
    return this.events.get(delegationId) ?? [];
  }

  public async deleteByDelegationId(delegationId: string): Promise<void> {
    this.events.delete(delegationId);
  }
}
