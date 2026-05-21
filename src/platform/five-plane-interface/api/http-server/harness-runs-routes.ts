/**
 * @fileoverview Harness Runs Routes - REST API for harness run management.
 *
 * Routes:
 * - GET /api/v1/harness-runs
 * - GET /api/v1/harness-runs/:id
 * - POST /api/v1/harness-runs
 * - PATCH /api/v1/harness-runs/:id
 *
 * Uses in-memory storage as a starting point; can be replaced with persistent storage later.
 */

import { newId, nowIso } from "../../../contracts/types/ids.js";
import type { RouteDefinition } from "./types.js";
import {
  buildJsonResponse,
  readLimit,
  readCursor,
  requirePrincipal,
} from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { HarnessRun as CanonicalHarnessRun, HarnessRunStatus } from "../../../contracts/executable-contracts/index.js";

class HarnessRunsApiError extends Error {
  public constructor(
    public readonly statusCode: number,
    code: string,
    message: string,
  ) {
    super(message);
    this.name = "HarnessRunsApiError";
  }
}

export interface HarnessRunsRouteDeps {
  authService: ApiAuthService | null;
}

/**
 * In-memory store for harness runs.
 * This is a simple implementation; replace with persistent storage in production.
 */
class InMemoryHarnessRunStore {
  private runs = new Map<string, CanonicalHarnessRun>();

  insert(run: CanonicalHarnessRun): void {
    this.runs.set(run.harnessRunId, run);
  }

  get(id: string): CanonicalHarnessRun | undefined {
    return this.runs.get(id);
  }

  update(id: string, updates: Partial<CanonicalHarnessRun>): CanonicalHarnessRun | undefined {
    const existing = this.runs.get(id);
    if (!existing) return undefined;
    const updated: CanonicalHarnessRun = {
      ...existing,
      ...updates,
      updatedAt: nowIso(),
    };
    this.runs.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.runs.delete(id);
  }

  list(limit: number, cursor: string | undefined): {
    runs: readonly CanonicalHarnessRun[];
    total: number;
    nextCursor: string | null;
    hasMore: boolean;
  } {
    const allRuns = Array.from(this.runs.values()).sort(
      (left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.harnessRunId.localeCompare(right.harnessRunId),
    );

    let startIndex = 0;
    if (cursor) {
      const decodedCursor = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8")) as { updatedAt: string; harnessRunId: string };
      startIndex = allRuns.findIndex(
        (run) =>
          run.updatedAt < decodedCursor.updatedAt ||
          (run.updatedAt === decodedCursor.updatedAt && run.harnessRunId > decodedCursor.harnessRunId),
      );
      if (startIndex < 0) startIndex = allRuns.length;
    }

    const pageRuns = allRuns.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < allRuns.length;
    const lastPageRun = pageRuns.at(-1);
    const nextCursor =
      hasMore && lastPageRun
        ? Buffer.from(JSON.stringify({ updatedAt: lastPageRun.updatedAt, harnessRunId: lastPageRun.harnessRunId })).toString("base64")
        : null;

    return { runs: pageRuns, total: allRuns.length, nextCursor, hasMore };
  }
}

// Module-level store instance (shared across route handlers)
const harnessRunStore = new InMemoryHarnessRunStore();

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

export function createHarnessRunsRoutes(deps: HarnessRunsRouteDeps): RouteDefinition[] {
  return [
    // ── GET /api/v1/harness-runs ───────────────────────────────────────────────
    {
      method: "GET",
      pathname: "/v1/harness-runs",
      handler: (ctx) => {
        const _principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const limit = readLimit(ctx.request, 25);
        const cursor = readCursor(ctx.request);
        const result = harnessRunStore.list(limit, cursor);
        return buildJsonResponse(ctx.requestId, 200, {
          harnessRuns: result.runs,
          total: result.total,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
          limit,
        });
      },
    },
    // ── GET /api/v1/harness-runs/:id/events ───────────────────────────────────
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const match = parseHarnessRunPath(ctx.route.segments);
        if (match == null || match.tail !== "events") {
          return null;
        }
        const _principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const run = harnessRunStore.get(match.harnessRunId);
        if (!run) {
          throw new HarnessRunsApiError(404, "api.harness_run_not_found", "Harness run not found.");
        }
        return buildJsonResponse(ctx.requestId, 200, {
          harnessRunId: match.harnessRunId,
          events: [],
        });
      },
    },
    // ── GET /api/v1/harness-runs/:id ──────────────────────────────────────────
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const match = parseHarnessRunPath(ctx.route.segments);
        if (match == null || match.tail != null) {
          return null;
        }
        const _principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const run = harnessRunStore.get(match.harnessRunId);
        if (!run) {
          throw new HarnessRunsApiError(404, "api.harness_run_not_found", "Harness run not found.");
        }
        return buildJsonResponse(ctx.requestId, 200, run);
      },
    },
    // ── POST /api/v1/harness-runs ───────────────────────────────────────────────
    {
      method: "POST",
      pathname: "/v1/harness-runs",
      handler: (ctx) => {
        const _principal = requirePrincipal(ctx.request, deps.authService, "operator");
        let body: Record<string, unknown> = {};
        try {
          if (ctx.request.body) {
            body = JSON.parse(ctx.request.body) as Record<string, unknown>;
          }
        } catch {
          throw new HarnessRunsApiError(400, "api.invalid_json", "Request body must be valid JSON.");
        }

        const tenantId = typeof body.tenantId === "string" && body.tenantId.trim().length > 0
          ? body.tenantId.trim()
          : "tenant:local";
        const domainId = typeof body.domainId === "string" && body.domainId.trim().length > 0
          ? body.domainId.trim()
          : null;
        if (domainId == null) {
          throw new HarnessRunsApiError(400, "api.domain_id_required", "domainId must be provided.");
        }
        const harnessRunId = newId("hrun");
        const now = nowIso();
        const riskLevel = (body.riskLevel as string) || "medium";

        const run: CanonicalHarnessRun = {
          harnessRunId,
          tenantId,
          orgId: tenantId,
          domainId,
          traceId: (body.traceId as string) || `trace:${harnessRunId}`,
          riskLevel: riskLevel as CanonicalHarnessRun["riskLevel"],
          riskProfile: { riskClass: riskLevel as CanonicalHarnessRun["riskLevel"], reasons: [`risk_level:${riskLevel}`] },
          ownership: {
            ownerId: (body.ownerId as string) || tenantId,
            ownerType: (body.ownerType as string) || "harness",
          },
          auditRefs: [],
          auditTrail: { auditRefs: [], evidenceRefs: [] },
          confirmedTaskSpecId: (body.confirmedTaskSpecId as string) || `confirmed_task_spec:${harnessRunId}`,
          requestEnvelopeId: (body.requestEnvelopeId as string) || `request_envelope:${harnessRunId}`,
          requestHash: (body.requestHash as string) || `request_hash:${harnessRunId}`,
          status: (body.status as HarnessRunStatus) || "created",
          constraintPackRef: (body.constraintPackRef as string) || `constraint_pack:${domainId}`,
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
          ...(body.planGraphBundleId != null ? { planGraphBundleId: body.planGraphBundleId as string } : {}),
          ...(body.leaseId != null ? { leaseId: body.leaseId as string } : {}),
        };

        harnessRunStore.insert(run);
        return buildJsonResponse(ctx.requestId, 201, run);
      },
    },
    // ── PATCH /api/v1/harness-runs/:id ─────────────────────────────────────────
    {
      method: "PATCH",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const match = parseHarnessRunPath(ctx.route.segments);
        if (match == null || match.tail != null) {
          return null;
        }
        const _principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const existing = harnessRunStore.get(match.harnessRunId);
        if (!existing) {
          throw new HarnessRunsApiError(404, "api.harness_run_not_found", "Harness run not found.");
        }

        let body: Record<string, unknown> = {};
        try {
          if (ctx.request.body) {
            body = JSON.parse(ctx.request.body) as Record<string, unknown>;
          }
        } catch {
          throw new HarnessRunsApiError(400, "api.invalid_json", "Request body must be valid JSON.");
        }

        const updated = harnessRunStore.update(match.harnessRunId, {
          ...(body.status !== undefined ? { status: body.status as HarnessRunStatus } : {}),
          ...(body.goal !== undefined ? { goal: body.goal as string } : {}),
          ...(body.mode !== undefined ? { mode: body.mode as string } : {}),
          ...(body.terminalAt !== undefined ? { terminalAt: body.terminalAt as string } : {}),
          ...(body.terminalReason !== undefined ? { terminalReason: body.terminalReason as string } : {}),
        });
        return buildJsonResponse(ctx.requestId, 200, updated);
      },
    },
    // ── DELETE /api/v1/harness-runs/:id ─────────────────────────────────────────
    {
      method: "DELETE",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const match = parseHarnessRunPath(ctx.route.segments);
        if (match == null || match.tail != null) {
          return null;
        }
        const _principal = requirePrincipal(ctx.request, deps.authService, "admin");
        const existing = harnessRunStore.get(match.harnessRunId);
        if (!existing) {
          throw new HarnessRunsApiError(404, "api.harness_run_not_found", "Harness run not found.");
        }
        harnessRunStore.delete(match.harnessRunId);
        return buildJsonResponse(ctx.requestId, 200, { harnessRunId: match.harnessRunId, status: "deleted" });
      },
    },
  ];
}
