/**
 * Delegation Audit Service
 *
 * Provides persistent audit trail for delegation operations:
 * - Delegation creation and lifecycle events
 * - Governance decisions
 * - Permission changes
 *
 * Architecture: §51 Delegation Governance
 */

import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const delegationAuditLogger = new StructuredLogger({ retentionLimit: 100 });
const AUDIT_LOCK_TIMEOUT_MS = 250;

function isNodeTestRunner(): boolean {
  return process.env.NODE_TEST_CONTEXT === "child-v8";
}

/** Writes a value as formatted JSON to a file */
function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

/** Safely reads and parses a JSON file, returning null if not found */
function safeReadJson<T>(path: string): T | null {
  if (!existsSync(path)) {
    return null;
  }
  const raw = readFileSync(path, "utf8").trim();
  if (raw.length === 0) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    delegationAuditLogger.error("delegation_audit.invalid_json", {
      path,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ValidationError("delegation_audit.invalid_json", `delegation_audit.invalid_json: ${path}`);
  }
}

function readPersistedEvents(path: string): DelegationAuditEvent[] {
  if (!existsSync(path)) {
    return [];
  }
  const raw = readFileSync(path, "utf8").trim();
  if (raw.length === 0) {
    return [];
  }
  if (raw.startsWith("[")) {
    return safeReadJson<DelegationAuditEvent[]>(path) ?? [];
  }
  const events: DelegationAuditEvent[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    try {
      events.push(JSON.parse(trimmed) as DelegationAuditEvent);
    } catch (error) {
      delegationAuditLogger.error("delegation_audit.invalid_json", {
        path,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ValidationError("delegation_audit.invalid_json", `delegation_audit.invalid_json: ${path}`);
    }
  }
  return events;
}

function acquireAuditLock(lockPath: string): number {
  mkdirSync(dirname(lockPath), { recursive: true });
  const deadline = Date.now() + AUDIT_LOCK_TIMEOUT_MS;
  while (true) {
    try {
      return openSync(lockPath, "wx");
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || (error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      if (Date.now() >= deadline) {
        throw new Error(`delegation_audit.lock_timeout:${lockPath}`);
      }
    }
  }
}

function releaseAuditLock(lockFd: number, lockPath: string): void {
  try {
    closeSync(lockFd);
  } finally {
    try {
      rmSync(lockPath, { force: true });
    } catch {
      // Best effort cleanup for lock release.
    }
  }
}

export type DelegationAuditEventType =
  | "delegation.governance.evaluated"
  | "delegation.governance.approved"
  | "delegation.governance.denied"
  | "delegation.created"
  | "delegation.completed"
  | "delegation.failed"
  | "delegation.cancelled"
  | "delegation.expired"
  | "delegation.permission_narrowed";

export interface DelegationAuditEvent {
  id: string;
  eventType: DelegationAuditEventType;
  delegationId: string | null;
  parentAgentId: string;
  childAgentId: string | null;
  depth: number;
  reasonCode: string;
  metadata: Record<string, unknown>;
  actorId: string;
  actorType: "user" | "agent" | "system";
  createdAt: string;
}

export interface DelegationAuditSummary {
  totalEvents: number;
  byType: Record<DelegationAuditEventType, number>;
  byAgent: Record<string, number>;
  lastEventAt: string | null;
}

export class DelegationAuditService {
  private readonly events: DelegationAuditEvent[] = [];
  private readonly auditDir: string;
  private readonly persistent: boolean;
  private eventFilePath: string;
  private readonly eventLockPath: string;

  public constructor(auditDir: string = resolveDefaultAuditDir()) {
    this.auditDir = auditDir;
    this.persistent = auditDir !== resolveDefaultAuditDir() || !isNodeTestRunner();
    this.eventFilePath = join(this.auditDir, "delegation-audit-events.json");
    this.eventLockPath = `${this.eventFilePath}.lock`;
    if (this.persistent) {
      this.loadEvents();
    }
  }

  /** Loads events from persistent storage */
  private loadEvents(): void {
    const loaded = readPersistedEvents(this.eventFilePath);
    const seen = new Set<string>();
    for (const event of loaded) {
      if (seen.has(event.id)) {
        continue;
      }
      seen.add(event.id);
      this.events.push(event);
    }
  }

  /** Persists a single event to disk */
  private persistEvent(event: DelegationAuditEvent): void {
    if (!this.persistent) {
      return;
    }
    mkdirSync(dirname(this.eventFilePath), { recursive: true });
    const lockFd = acquireAuditLock(this.eventLockPath);
    try {
      appendFileSync(this.eventFilePath, `${JSON.stringify(event)}\n`, "utf8");
    } finally {
      releaseAuditLock(lockFd, this.eventLockPath);
    }
  }

  public record(event: Omit<DelegationAuditEvent, "id" | "createdAt">): DelegationAuditEvent {
    const record: DelegationAuditEvent = {
      ...event,
      id: newId("dlg_audit"),
      createdAt: nowIso(),
    };
    this.persistEvent(record);
    this.events.push(record);
    return record;
  }

  public recordGovernanceEvaluation(params: {
    delegationId: string | null;
    parentAgentId: string;
    childAgentId: string | null;
    depth: number;
    reasonCode: string;
    decision: "allow" | "deny" | "allow_with_constraints" | "require_approval";
    evaluatedRules: string[];
    actorId: string;
    actorType: "user" | "agent" | "system";
  }): DelegationAuditEvent {
    return this.record({
      eventType: params.decision === "deny"
        ? "delegation.governance.denied"
        : params.decision === "require_approval"
          ? "delegation.governance.evaluated"
          : "delegation.governance.approved",
      delegationId: params.delegationId,
      parentAgentId: params.parentAgentId,
      childAgentId: params.childAgentId,
      depth: params.depth,
      reasonCode: params.reasonCode,
      metadata: { evaluatedRules: params.evaluatedRules },
      actorId: params.actorId,
      actorType: params.actorType,
    });
  }

  public recordDelegationCreated(params: {
    delegationId: string;
    parentAgentId: string;
    childAgentId: string;
    depth: number;
    reasonCode?: string;
    actorId: string;
    actorType: "user" | "agent" | "system";
  }): DelegationAuditEvent {
    return this.record({
      eventType: "delegation.created",
      delegationId: params.delegationId,
      parentAgentId: params.parentAgentId,
      childAgentId: params.childAgentId,
      depth: params.depth,
      reasonCode: params.reasonCode ?? "delegation.created",
      metadata: {},
      actorId: params.actorId,
      actorType: params.actorType,
    });
  }

  public recordDelegationCompleted(params: {
    delegationId: string;
    parentAgentId: string;
    childAgentId: string;
    durationMs: number;
    depth: number;
    actorId: string;
    actorType: "user" | "agent" | "system";
  }): DelegationAuditEvent {
    return this.record({
      eventType: "delegation.completed",
      delegationId: params.delegationId,
      parentAgentId: params.parentAgentId,
      childAgentId: params.childAgentId,
      depth: params.depth,
      reasonCode: "delegation.completed",
      metadata: { durationMs: params.durationMs },
      actorId: params.actorId,
      actorType: params.actorType,
    });
  }

  public recordDelegationFailed(params: {
    delegationId: string;
    parentAgentId: string;
    childAgentId: string;
    error: string;
    depth: number;
    actorId: string;
    actorType: "user" | "agent" | "system";
  }): DelegationAuditEvent {
    return this.record({
      eventType: "delegation.failed",
      delegationId: params.delegationId,
      parentAgentId: params.parentAgentId,
      childAgentId: params.childAgentId,
      depth: params.depth,
      reasonCode: "delegation.failed",
      metadata: { error: params.error },
      actorId: params.actorId,
      actorType: params.actorType,
    });
  }

  public recordPermissionNarrowed(params: {
    delegationId: string;
    parentAgentId: string;
    childAgentId: string;
    depth: number;
    originalPermissions: Record<string, unknown>;
    narrowedPermissions: Record<string, unknown>;
    actorId: string;
    actorType: "user" | "agent" | "system";
  }): DelegationAuditEvent {
    return this.record({
      eventType: "delegation.permission_narrowed",
      delegationId: params.delegationId,
      parentAgentId: params.parentAgentId,
      childAgentId: params.childAgentId,
      depth: params.depth,
      reasonCode: "delegation.permission_narrowed",
      metadata: {
        originalPermissions: params.originalPermissions,
        narrowedPermissions: params.narrowedPermissions,
      },
      actorId: params.actorId,
      actorType: params.actorType,
    });
  }

  public getByDelegation(delegationId: string): DelegationAuditEvent[] {
    return this.events.filter((e) => e.delegationId === delegationId);
  }

  public getByAgent(agentId: string): DelegationAuditEvent[] {
    return this.events.filter((e) => e.actorId === agentId);
  }

  public getRecentEvents(limit: number = 50): DelegationAuditEvent[] {
    return [...this.events]
      .map((event, index) => ({ event, index }))
      .sort((a, b) => {
        const timeDiff = b.event.createdAt.localeCompare(a.event.createdAt);
        if (timeDiff !== 0) {
          return timeDiff;
        }
        return b.index - a.index;
      })
      .slice(0, limit)
      .map(({ event }) => event);
  }

  public getSummary(): DelegationAuditSummary {
    const byType: Record<DelegationAuditEventType, number> = {
      "delegation.governance.evaluated": 0,
      "delegation.governance.approved": 0,
      "delegation.governance.denied": 0,
      "delegation.created": 0,
      "delegation.completed": 0,
      "delegation.failed": 0,
      "delegation.cancelled": 0,
      "delegation.expired": 0,
      "delegation.permission_narrowed": 0,
    };

    const byAgent: Record<string, number> = {};
    let lastEventAt: string | null = null;

    for (const event of this.events) {
      byType[event.eventType]++;
      byAgent[event.parentAgentId] = (byAgent[event.parentAgentId] ?? 0) + 1;
      if (!lastEventAt || event.createdAt > lastEventAt) {
        lastEventAt = event.createdAt;
      }
    }

    return {
      totalEvents: this.events.length,
      byType,
      byAgent,
      lastEventAt,
    };
  }

  public listEvents(): DelegationAuditEvent[] {
    return [...this.events];
  }
}

function resolveDefaultAuditDir(): string {
  return process.env.AA_DELEGATION_AUDIT_DIR?.trim() || join(process.cwd(), ".audit", "delegation");
}

export const delegationAuditService = new DelegationAuditService();
