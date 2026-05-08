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

  list(limit: number, cursor: string | undefined): {
    runs: readonly CanonicalHarnessRun[];
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
    const nextCursor =
      hasMore && pageRuns.length > 0
        ? Buffer.from(JSON.stringify({ updatedAt: pageRuns.at(-1)!.updatedAt, harnessRunId: pageRuns.at(-1)!.harnessRunId })).toString("base64")
        : null;

    return { runs: pageRuns, nextCursor, hasMore };
  }
}

// Module-level store instance (shared across route handlers)
const harnessRunStore = new InMemoryHarnessRunStore();

export function createHarnessRunsRoutes(deps: HarnessRunsRouteDeps): RouteDefinition[] {
  return [
    // ── GET /api/v1/harness-runs ───────────────────────────────────────────────
    {
      method: "GET",
      pathname: "/api/v1/harness-runs",
      handler: (ctx) => {
        const _principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const limit = readLimit(ctx.request, 25);
        const cursor = readCursor(ctx.request);
        const result = harnessRunStore.list(limit, cursor);
        return buildJsonResponse(ctx.requestId, 200, {
          harnessRuns: result.runs,
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
          limit,
        });
      },
    },
    // ── GET /api/v1/harness-runs/:id ──────────────────────────────────────────
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (segments[0] !== "api" || segments[1] !== "v1" || segments[2] !== "harness-runs" || segments.length !== 4) {
          return null;
        }
        const _principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const harnessRunId = segments[3];
        const run = harnessRunStore.get(harnessRunId);
        if (!run) {
          throw new HarnessRunsApiError(404, "api.harness_run_not_found", "Harness run not found.");
        }
        return buildJsonResponse(ctx.requestId, 200, run);
      },
    },
    // ── POST /api/v1/harness-runs ───────────────────────────────────────────────
    {
      method: "POST",
      pathname: "/api/v1/harness-runs",
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

        const tenantId = (body.tenantId as string) || "tenant:local";
        const domainId = (body.domainId as string) || "default";
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
          planGraphBundleId: (body.planGraphBundleId as string) || undefined,
          budgetLedgerId: newId("budget_ledger"),
          budgetEnvelope: {
            budgetLedgerId: newId("budget_ledger"),
            currency: "credits",
          },
          currentSeq: 0,
          createdAt: now,
          updatedAt: now,
          leaseId: (body.leaseId as string) || undefined,
          fencingToken: `fence:${harnessRunId}:0`,
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
        const { segments } = ctx.route;
        if (segments[0] !== "api" || segments[1] !== "v1" || segments[2] !== "harness-runs" || segments.length !== 4) {
          return null;
        }
        const _principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const harnessRunId = segments[3];
        const existing = harnessRunStore.get(harnessRunId);
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

        const updated = harnessRunStore.update(harnessRunId, {
          ...(body.status !== undefined ? { status: body.status as HarnessRunStatus } : {}),
          ...(body.goal !== undefined ? { goal: body.goal as string } : {}),
          ...(body.mode !== undefined ? { mode: body.mode as string } : {}),
          ...(body.terminalAt !== undefined ? { terminalAt: body.terminalAt as string } : {}),
          ...(body.terminalReason !== undefined ? { terminalReason: body.terminalReason as string } : {}),
        });
        return buildJsonResponse(ctx.requestId, 200, updated);
      },
    },
  ];
}
