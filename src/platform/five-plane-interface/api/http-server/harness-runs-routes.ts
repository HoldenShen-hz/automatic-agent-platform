/**
 * @fileoverview Harness Runs Routes - REST API for harness run management.
 */

import { newId, nowIso } from "../../../contracts/types/ids.js";
import type { RouteDefinition } from "./types.js";
import {
  buildJsonResponse,
  decodeOpaqueCursor,
  encodeOpaqueCursor,
  readLimit,
  readCursor,
  readJsonRecord,
  requirePrincipal,
} from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { HarnessRun as CanonicalHarnessRun, HarnessRunStatus } from "../../../contracts/executable-contracts/index.js";

const HARNESS_RISK_LEVELS = new Set<CanonicalHarnessRun["riskLevel"]>(["low", "medium", "high", "critical"]);
const HARNESS_RUN_STATUSES = new Set<HarnessRunStatus>([
  "created",
  "admitted",
  "planning",
  "ready",
  "running",
  "pausing",
  "paused",
  "resuming",
  "replanning",
  "compensating",
  "completed",
  "failed",
  "cancelled",
  "aborted",
]);
const TERMINAL_HARNESS_RUN_STATUSES = new Set<HarnessRunStatus>(["completed", "failed", "cancelled", "aborted"]);
const PATCHABLE_FIELDS = new Set(["status", "goal", "mode", "terminalAt", "terminalReason"]);

interface HarnessRunCursor {
  readonly updatedAt: string;
  readonly harnessRunId: string;
}

interface HarnessRunEvent {
  readonly eventId: string;
  readonly harnessRunId: string;
  readonly eventType: "created" | "updated";
  readonly occurredAt: string;
  readonly payload: Record<string, unknown>;
}

export class HarnessRunsApiError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HarnessRunsApiError";
  }
}

export interface HarnessRunStore {
  insert(run: CanonicalHarnessRun): void;
  get(id: string): CanonicalHarnessRun | undefined;
  update(id: string, updates: Partial<CanonicalHarnessRun>): CanonicalHarnessRun | undefined;
  delete(id: string): boolean;
  list(limit: number, cursor: string | undefined): {
    runs: readonly CanonicalHarnessRun[];
    total: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
  listEvents(id: string): readonly HarnessRunEvent[];
}

export interface HarnessRunsRouteDeps {
  authService: ApiAuthService | null;
  store?: HarnessRunStore;
}

class InMemoryHarnessRunStore implements HarnessRunStore {
  private readonly runs = new Map<string, CanonicalHarnessRun>();
  private readonly orderedRunIds: string[] = [];
  private readonly eventsByRunId = new Map<string, HarnessRunEvent[]>();

  public insert(run: CanonicalHarnessRun): void {
    this.runs.set(run.harnessRunId, run);
    this.insertOrdered(run);
    this.eventsByRunId.set(run.harnessRunId, [
      {
        eventId: newId("harness_event"),
        harnessRunId: run.harnessRunId,
        eventType: "created",
        occurredAt: run.createdAt,
        payload: { status: run.status, riskLevel: run.riskLevel },
      },
    ]);
  }

  public get(id: string): CanonicalHarnessRun | undefined {
    return this.runs.get(id);
  }

  public update(id: string, updates: Partial<CanonicalHarnessRun>): CanonicalHarnessRun | undefined {
    const existing = this.runs.get(id);
    if (!existing) {
      return undefined;
    }
    const updated: CanonicalHarnessRun = {
      ...existing,
      ...updates,
      updatedAt: nowIso(),
    };
    this.runs.set(id, updated);
    this.reposition(updated);
    const events = this.eventsByRunId.get(id) ?? [];
    const changedFields = Object.keys(updates);
    events.push({
      eventId: newId("harness_event"),
      harnessRunId: id,
      eventType: "updated",
      occurredAt: updated.updatedAt,
      payload: {
        changedFields,
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.terminalReason !== undefined ? { terminalReason: updates.terminalReason } : {}),
      },
    });
    this.eventsByRunId.set(id, events);
    return updated;
  }

  public delete(id: string): boolean {
    const deleted = this.runs.delete(id);
    if (!deleted) {
      return false;
    }
    const index = this.orderedRunIds.indexOf(id);
    if (index >= 0) {
      this.orderedRunIds.splice(index, 1);
    }
    this.eventsByRunId.delete(id);
    return true;
  }

  public list(limit: number, cursor: string | undefined): {
    runs: readonly CanonicalHarnessRun[];
    total: number;
    nextCursor: string | null;
    hasMore: boolean;
  } {
    let startIndex = 0;
    if (cursor) {
      const decodedCursor = decodeHarnessRunCursor(cursor);
      startIndex = this.findStartIndex(decodedCursor);
    }
    const pageIds = this.orderedRunIds.slice(startIndex, startIndex + limit);
    const pageRuns = pageIds.map((id) => this.runs.get(id)).filter((run): run is CanonicalHarnessRun => run != null);
    const hasMore = startIndex + limit < this.orderedRunIds.length;
    const lastPageRun = pageRuns.at(-1);
    const nextCursor = hasMore && lastPageRun
      ? encodeOpaqueCursor({
        updatedAt: lastPageRun.updatedAt,
        harnessRunId: lastPageRun.harnessRunId,
      })
      : null;
    return {
      runs: pageRuns,
      total: this.orderedRunIds.length,
      nextCursor,
      hasMore,
    };
  }

  public listEvents(id: string): readonly HarnessRunEvent[] {
    return [...(this.eventsByRunId.get(id) ?? [])];
  }

  private insertOrdered(run: CanonicalHarnessRun): void {
    const index = this.findInsertionIndex(run);
    this.orderedRunIds.splice(index, 0, run.harnessRunId);
  }

  private reposition(run: CanonicalHarnessRun): void {
    const currentIndex = this.orderedRunIds.indexOf(run.harnessRunId);
    if (currentIndex >= 0) {
      this.orderedRunIds.splice(currentIndex, 1);
    }
    this.insertOrdered(run);
  }

  private findInsertionIndex(candidate: CanonicalHarnessRun): number {
    for (let index = 0; index < this.orderedRunIds.length; index += 1) {
      const current = this.runs.get(this.orderedRunIds[index]!);
      if (current == null) {
        continue;
      }
      if (compareHarnessRuns(candidate, current) < 0) {
        return index;
      }
    }
    return this.orderedRunIds.length;
  }

  private findStartIndex(cursor: HarnessRunCursor): number {
    for (let index = 0; index < this.orderedRunIds.length; index += 1) {
      const run = this.runs.get(this.orderedRunIds[index]!);
      if (run == null) {
        continue;
      }
      if (
        run.updatedAt < cursor.updatedAt
        || (run.updatedAt === cursor.updatedAt && run.harnessRunId > cursor.harnessRunId)
      ) {
        return index;
      }
    }
    return this.orderedRunIds.length;
  }
}

function compareHarnessRuns(left: CanonicalHarnessRun, right: CanonicalHarnessRun): number {
  const byTimestamp = right.updatedAt.localeCompare(left.updatedAt);
  if (byTimestamp !== 0) {
    return byTimestamp;
  }
  return left.harnessRunId.localeCompare(right.harnessRunId);
}

function decodeHarnessRunCursor(cursor: string): HarnessRunCursor {
  try {
    const decoded = decodeOpaqueCursor<HarnessRunCursor>(cursor, "api.invalid_cursor");
    if (
      typeof decoded.updatedAt !== "string"
      || decoded.updatedAt.length === 0
      || typeof decoded.harnessRunId !== "string"
      || decoded.harnessRunId.length === 0
    ) {
      throw new Error("invalid");
    }
    return decoded;
  } catch (error) {
    if (error instanceof HarnessRunsApiError) {
      throw error;
    }
    throw new HarnessRunsApiError(400, "api.invalid_cursor", "cursor is invalid.");
  }
}

function parseHarnessRunPath(
  segments: readonly string[],
): { harnessRunId: string; tail: string | undefined } | null {
  const prefixLength = segments[0] === "api" && segments[1] === "v1"
    ? 2
    : segments[0] === "v1"
      ? 1
      : -1;
  if (prefixLength < 0 || segments[prefixLength] !== "harness-runs") {
    return null;
  }
  const harnessRunId = segments[prefixLength + 1];
  if (harnessRunId == null || segments.length > prefixLength + 3) {
    return null;
  }
  return { harnessRunId, tail: segments[prefixLength + 2] };
}

function parseJsonBody(body: string | null): Record<string, unknown> {
  if (body == null) {
    return {};
  }
  try {
    return readJsonRecord(body, {
      maxBytes: 256 * 1024,
      emptyValue: {},
    });
  } catch {
    throw new HarnessRunsApiError(400, "api.invalid_json", "Request body must be valid JSON.");
  }
}

function readRequiredDomainId(body: Record<string, unknown>): string {
  const domainId = readOptionalString(body.domainId);
  if (domainId == null) {
    throw new HarnessRunsApiError(400, "api.domain_id_required", "domainId must be provided.");
  }
  return domainId;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readRiskLevel(value: unknown): CanonicalHarnessRun["riskLevel"] {
  const normalized = readOptionalString(value) ?? "medium";
  if (!HARNESS_RISK_LEVELS.has(normalized as CanonicalHarnessRun["riskLevel"])) {
    throw new HarnessRunsApiError(400, "api.invalid_risk_level", "riskLevel is invalid.");
  }
  return normalized as CanonicalHarnessRun["riskLevel"];
}

function readStatus(value: unknown, fallback: HarnessRunStatus = "created"): HarnessRunStatus {
  const normalized = readOptionalString(value) ?? fallback;
  if (!HARNESS_RUN_STATUSES.has(normalized as HarnessRunStatus)) {
    throw new HarnessRunsApiError(400, "api.invalid_harness_run_status", "status is invalid.");
  }
  return normalized as HarnessRunStatus;
}

function validateTerminalAt(value: unknown): string | undefined {
  const normalized = readOptionalString(value);
  if (normalized == null) {
    return undefined;
  }
  if (Number.isNaN(Date.parse(normalized))) {
    throw new HarnessRunsApiError(400, "api.invalid_terminal_at", "terminalAt must be an ISO-8601 timestamp.");
  }
  return normalized;
}

function buildPatchUpdates(
  body: Record<string, unknown>,
  existing: CanonicalHarnessRun,
): Partial<CanonicalHarnessRun> {
  for (const key of Object.keys(body)) {
    if (!PATCHABLE_FIELDS.has(key)) {
      throw new HarnessRunsApiError(400, "api.invalid_harness_run_patch_field", `PATCH field '${key}' is not allowed.`);
    }
  }
  const status = body.status !== undefined ? readStatus(body.status, existing.status) : undefined;
  const goal = body.goal !== undefined ? readOptionalString(body.goal) : undefined;
  const mode = body.mode !== undefined ? readOptionalString(body.mode) : undefined;
  const terminalAt = body.terminalAt !== undefined ? validateTerminalAt(body.terminalAt) : undefined;
  const terminalReason = body.terminalReason !== undefined ? readOptionalString(body.terminalReason) : undefined;
  if ((terminalReason !== undefined || terminalAt !== undefined) && !TERMINAL_HARNESS_RUN_STATUSES.has(status ?? existing.status)) {
    throw new HarnessRunsApiError(
      400,
      "api.invalid_harness_run_terminal_update",
      "terminalAt and terminalReason require a terminal status.",
    );
  }
  return {
    ...(status !== undefined ? { status } : {}),
    ...(goal !== undefined ? { goal } : {}),
    ...(mode !== undefined ? { mode } : {}),
    ...(terminalReason !== undefined ? { terminalReason } : {}),
    ...(terminalAt !== undefined ? { terminalAt } : {}),
    ...(status !== undefined && TERMINAL_HARNESS_RUN_STATUSES.has(status) && terminalAt === undefined
      ? { terminalAt: nowIso() }
      : {}),
  };
}

export function createHarnessRunsRoutes(deps: HarnessRunsRouteDeps): RouteDefinition[] {
  const store = deps.store ?? new InMemoryHarnessRunStore();

  return [
    {
      method: "GET",
      pathname: "/v1/harness-runs",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const limit = readLimit(ctx.request, 25);
        const cursor = readCursor(ctx.request);
        const result = store.list(limit, cursor);
        return buildJsonResponse(ctx.requestId, 200, {
          harnessRuns: result.runs,
          total: result.total,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
          limit,
        });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const match = parseHarnessRunPath(ctx.route.segments);
        if (match == null || match.tail !== "events") {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const run = store.get(match.harnessRunId);
        if (!run) {
          throw new HarnessRunsApiError(404, "api.harness_run_not_found", "Harness run not found.");
        }
        return buildJsonResponse(ctx.requestId, 200, {
          harnessRunId: match.harnessRunId,
          events: store.listEvents(match.harnessRunId),
        });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const match = parseHarnessRunPath(ctx.route.segments);
        if (match == null || match.tail != null) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const run = store.get(match.harnessRunId);
        if (!run) {
          throw new HarnessRunsApiError(404, "api.harness_run_not_found", "Harness run not found.");
        }
        return buildJsonResponse(ctx.requestId, 200, run);
      },
    },
    {
      method: "POST",
      pathname: "/v1/harness-runs",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "operator");
        const body = parseJsonBody(ctx.request.body ?? null);
        const tenantId = readOptionalString(body.tenantId) ?? "tenant:local";
        const domainId = readRequiredDomainId(body);
        const harnessRunId = newId("hrun");
        const now = nowIso();
        const riskLevel = readRiskLevel(body.riskLevel);
        const status = readStatus(body.status);
        const goal = readOptionalString(body.goal);
        const mode = readOptionalString(body.mode);
        const planGraphBundleId = readOptionalString(body.planGraphBundleId);
        const leaseId = readOptionalString(body.leaseId);

        const run: CanonicalHarnessRun = {
          harnessRunId,
          tenantId,
          orgId: tenantId,
          domainId,
          traceId: readOptionalString(body.traceId) ?? `trace:${harnessRunId}`,
          riskLevel,
          riskProfile: { riskClass: riskLevel, reasons: [`risk_level:${riskLevel}`] },
          ownership: {
            ownerId: readOptionalString(body.ownerId) ?? tenantId,
            ownerType: readOptionalString(body.ownerType) ?? "harness",
          },
          auditRefs: [],
          auditTrail: { auditRefs: [], evidenceRefs: [] },
          confirmedTaskSpecId: readOptionalString(body.confirmedTaskSpecId) ?? `confirmed_task_spec:${harnessRunId}`,
          requestEnvelopeId: readOptionalString(body.requestEnvelopeId) ?? `request_envelope:${harnessRunId}`,
          requestHash: readOptionalString(body.requestHash) ?? `request_hash:${harnessRunId}`,
          status,
          constraintPackRef: readOptionalString(body.constraintPackRef) ?? `constraint_pack:${domainId}`,
          versionLockId: newId("run_version_lock"),
          budgetLedgerId: newId("budget_ledger"),
          budgetEnvelope: {
            budgetLedgerId: newId("budget_ledger"),
            currency: "credits",
          },
          currentSeq: 0,
          createdAt: now,
          updatedAt: now,
          fencingToken: `fence:${harnessRunId}:0`,
          ...(goal != null ? { goal } : {}),
          ...(mode != null ? { mode } : {}),
          ...(planGraphBundleId != null ? { planGraphBundleId } : {}),
          ...(leaseId != null ? { leaseId } : {}),
        };

        store.insert(run);
        return buildJsonResponse(ctx.requestId, 201, run);
      },
    },
    {
      method: "PATCH",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const match = parseHarnessRunPath(ctx.route.segments);
        if (match == null || match.tail != null) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "operator");
        const existing = store.get(match.harnessRunId);
        if (!existing) {
          throw new HarnessRunsApiError(404, "api.harness_run_not_found", "Harness run not found.");
        }
        const body = parseJsonBody(ctx.request.body ?? null);
        const updates = buildPatchUpdates(body, existing);
        const updated = store.update(match.harnessRunId, updates);
        return buildJsonResponse(ctx.requestId, 200, updated);
      },
    },
    {
      method: "DELETE",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const match = parseHarnessRunPath(ctx.route.segments);
        if (match == null || match.tail != null) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "admin");
        const existing = store.get(match.harnessRunId);
        if (!existing) {
          throw new HarnessRunsApiError(404, "api.harness_run_not_found", "Harness run not found.");
        }
        store.delete(match.harnessRunId);
        return buildJsonResponse(ctx.requestId, 200, { harnessRunId: match.harnessRunId, status: "deleted" });
      },
    },
  ];
}
