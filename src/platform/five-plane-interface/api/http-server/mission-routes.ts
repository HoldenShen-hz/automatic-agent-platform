import { newId, nowIso } from "../../../contracts/types/ids.js";
import {
  buildMissionEtag,
  MissionRecordSchema,
  MissionResolutionRequestSchema,
  type MissionPermission,
  type MissionRecord,
  type MissionRole,
} from "../../../contracts/mission/index.js";
import {
  InMemoryMissionRepository,
  type MissionRepository,
} from "../../../five-plane-state-evidence/truth/mission-repository.js";
import {
  MissionGovernanceService,
  MissionLifecycleService,
  MissionResolver,
} from "../../../five-plane-control-plane/mission/index.js";
import type { ApiAuthService } from "../api-auth-service.js";
import { readJsonBody, requirePrincipal, buildJsonResponse, buildJsonErrorResponse } from "./utils.js";
import type { RouteDefinition } from "./types.js";

export interface MissionRouteDeps {
  readonly authService: ApiAuthService | null;
  readonly missionRepository?: MissionRepository | null;
}

const defaultRepository = new InMemoryMissionRepository();

export function createMissionRoutes(deps: MissionRouteDeps): RouteDefinition[] {
  const repository = deps.missionRepository ?? defaultRepository;
  const lifecycle = new MissionLifecycleService(repository);
  const governance = new MissionGovernanceService(repository);
  const resolver = new MissionResolver(repository, governance);

  return [
    {
      method: "POST",
      pathname: "/v1/missions",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const body = readJsonBody(ctx.request.body) as Record<string, unknown>;
        const tenantId = typeof body["tenantId"] === "string"
          ? body["tenantId"]
          : principal.tenantId ?? `tenant:${principal.actorId}`;
        const mission = lifecycle.createMission({
          tenantId,
          orgId: typeof body["orgId"] === "string" ? body["orgId"] : tenantId,
          type: body["type"] === "ad_hoc" || body["type"] === "program" || body["type"] === "incident" || body["type"] === "scheduled"
            ? body["type"]
            : "formal",
          priority: body["priority"] === "low" || body["priority"] === "high" || body["priority"] === "critical"
            ? body["priority"]
            : "normal",
          title: typeof body["title"] === "string" ? body["title"] : "Untitled mission",
          description: typeof body["description"] === "string" ? body["description"] : null,
          objective: typeof body["objective"] === "string" ? body["objective"] : "Mission objective pending refinement",
          successCriteria: Array.isArray(body["successCriteria"]) && body["successCriteria"].every((item) => typeof item === "string")
            ? body["successCriteria"] as string[]
            : ["mission accepted"],
          ownerPrincipalId: typeof body["ownerPrincipalId"] === "string" ? body["ownerPrincipalId"] : principal.actorId,
          accountablePrincipalId: typeof body["accountablePrincipalId"] === "string" ? body["accountablePrincipalId"] : null,
          domainId: typeof body["domainId"] === "string" ? body["domainId"] : null,
          policyRefs: Array.isArray(body["policyRefs"]) && body["policyRefs"].every((item) => typeof item === "string")
            ? body["policyRefs"] as string[]
            : [],
          riskProfileRef: typeof body["riskProfileRef"] === "string" ? body["riskProfileRef"] : null,
          budgetEnvelopeRef: typeof body["budgetEnvelopeRef"] === "string" ? body["budgetEnvelopeRef"] : null,
          knowledgeBoundaryRef: typeof body["knowledgeBoundaryRef"] === "string" ? body["knowledgeBoundaryRef"] : null,
          defaultWorkflowTemplateRefs: Array.isArray(body["defaultWorkflowTemplateRefs"]) && body["defaultWorkflowTemplateRefs"].every((item) => typeof item === "string")
            ? body["defaultWorkflowTemplateRefs"] as string[]
            : [],
          createdBy: principal.actorId,
          traceId: ctx.request.headers["x-trace-id"] ?? ctx.requestId,
          correlationId: ctx.request.headers["x-correlation-id"] ?? ctx.requestId,
        });
        return buildJsonResponse(ctx.requestId, 201, { mission });
      },
    },
    {
      method: "GET",
      pathname: "/v1/missions",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const tenantId = ctx.request.headers["x-tenant-id"] ?? principal.tenantId ?? `tenant:${principal.actorId}`;
        return buildJsonResponse(ctx.requestId, 200, { missions: repository.listMissions(tenantId) });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const segments = ctx.route.segments;
        const missionSegment = segments[2];
        if (segments[0] !== "v1" || segments[1] !== "missions" || segments.length !== 3 || missionSegment == null || missionSegment.includes(":")) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const mission = repository.getMission(missionSegment);
        if (mission == null) {
          return buildJsonErrorResponse(ctx.requestId, 404, { code: "mission.not_found", message: "Mission not found." });
        }
        return buildJsonResponse(ctx.requestId, 200, { mission });
      },
    },
    {
      method: "PATCH",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const segments = ctx.route.segments;
        const missionSegment = segments[2];
        if (segments[0] !== "v1" || segments[1] !== "missions" || segments.length !== 3 || missionSegment == null || missionSegment.includes(":")) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const current = repository.getMission(missionSegment);
        if (current == null) {
          return buildJsonErrorResponse(ctx.requestId, 404, { code: "mission.not_found", message: "Mission not found." });
        }
        const ifMatch = ctx.request.headers["if-match"];
        if (ifMatch == null || ifMatch !== current.etag) {
          return buildJsonErrorResponse(ctx.requestId, ifMatch == null ? 428 : 409, {
            code: ifMatch == null ? "mission.if_match_required" : "mission.version_conflict",
            message: ifMatch == null ? "Mission update requires If-Match." : "Mission version conflict.",
          });
        }
        const body = readJsonBody(ctx.request.body) as Record<string, unknown>;
        const timestamp = nowIso();
        const nextVersion = current.version + 1;
        const updated = MissionRecordSchema.parse({
          ...current,
          ...pickMissionPatch(current, body),
          updatedAt: timestamp,
          updatedBy: principal.actorId,
          version: nextVersion,
          etag: buildMissionEtag(current.missionId, nextVersion),
        });
        const mission = repository.updateMission(updated, {
          eventType: "platform.mission.updated",
          missionId: updated.missionId,
          tenantId: updated.tenantId,
          traceId: ctx.request.headers["x-trace-id"] ?? ctx.requestId,
          correlationId: ctx.request.headers["x-correlation-id"] ?? ctx.requestId,
          payload: { missionId: updated.missionId, changedFields: Object.keys(body).sort() },
          occurredAt: timestamp,
        });
        return buildJsonResponse(ctx.requestId, 200, { mission });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const segments = ctx.route.segments;
        if (segments[0] !== "v1" || segments[1] !== "missions" || segments.length !== 4) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const mission = repository.getMission(segments[2]!);
        if (mission == null) {
          return buildJsonErrorResponse(ctx.requestId, 404, { code: "mission.not_found", message: "Mission not found." });
        }
        switch (segments[3]) {
          case "members":
            return buildJsonResponse(ctx.requestId, 200, { members: repository.listMemberships(mission.missionId) });
          case "tasks":
            return buildJsonResponse(ctx.requestId, 200, { tasks: repository.listMissionTasks(mission.missionId) });
          case "runs":
            return buildJsonResponse(ctx.requestId, 200, { runs: repository.listMissionRuns(mission.missionId) });
          case "evidence":
            return buildJsonResponse(ctx.requestId, 200, { evidence: repository.listMissionEvidence(mission.missionId) });
          case "budget":
            return buildJsonResponse(ctx.requestId, 200, {
              budget: {
                missionId: mission.missionId,
                budgetEnvelopeRef: mission.budgetEnvelopeRef,
                status: mission.budgetEnvelopeRef == null ? "not_configured" : "configured",
              },
            });
          default:
            return null;
        }
      },
    },
    {
      method: "POST",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const segments = ctx.route.segments;
        if (segments[0] !== "v1" || segments[1] !== "missions" || segments.length !== 4 || segments[3] !== "members") {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const mission = repository.getMission(segments[2]!);
        if (mission == null) {
          return buildJsonErrorResponse(ctx.requestId, 404, { code: "mission.not_found", message: "Mission not found." });
        }
        const body = readJsonBody(ctx.request.body) as Record<string, unknown>;
        const permissions = readPermissions(body["permissions"]);
        const member = repository.addMembership({
          membershipId: typeof body["membershipId"] === "string" ? body["membershipId"] : newId("mship"),
          missionId: mission.missionId,
          tenantId: mission.tenantId,
          principalType: body["principalType"] === "service" || body["principalType"] === "agent" || body["principalType"] === "team"
            ? body["principalType"]
            : "user",
          principalId: typeof body["principalId"] === "string" ? body["principalId"] : principal.actorId,
          role: readRole(body["role"]),
          permissions,
          deniedPermissions: readPermissions(body["deniedPermissions"]),
          status: "active",
          grantedBy: principal.actorId,
          grantedAt: nowIso(),
          expiresAt: typeof body["expiresAt"] === "string" ? body["expiresAt"] : null,
          metadata: {},
        });
        return buildJsonResponse(ctx.requestId, 201, { member });
      },
    },
    {
      method: "DELETE",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const segments = ctx.route.segments;
        if (
          segments[0] !== "v1"
          || segments[1] !== "missions"
          || segments.length !== 5
          || segments[3] !== "members"
        ) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const member = repository.revokeMembershipById(
          segments[2]!,
          segments[4]!,
          principal.actorId,
          ctx.request.headers["x-trace-id"] ?? ctx.requestId,
          ctx.request.headers["x-correlation-id"] ?? ctx.requestId,
        );
        if (member == null) {
          return buildJsonErrorResponse(ctx.requestId, 404, { code: "mission.member_not_found", message: "Mission member not found." });
        }
        return buildJsonResponse(ctx.requestId, 200, { member });
      },
    },
    {
      method: "POST",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const segments = ctx.route.segments;
        const actionSegment = segments[2];
        if (segments[0] !== "v1" || segments[1] !== "missions" || segments.length !== 3 || actionSegment == null || !actionSegment.includes(":")) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const [missionId, action] = actionSegment.split(":");
        const targetStatus = actionToStatus(action);
        if (targetStatus == null || missionId == null || missionId.length === 0) {
          return null;
        }
        const current = repository.getMission(missionId);
        if (current == null) {
          return buildJsonErrorResponse(ctx.requestId, 404, { code: "mission.not_found", message: "Mission not found." });
        }
        const mission = lifecycle.transition({
          missionId,
          expectedVersion: current.version,
          ifMatch: ctx.request.headers["if-match"] ?? current.etag,
          targetStatus,
          actorId: principal.actorId,
          traceId: ctx.request.headers["x-trace-id"] ?? ctx.requestId,
          correlationId: ctx.request.headers["x-correlation-id"] ?? ctx.requestId,
        });
        return buildJsonResponse(ctx.requestId, 200, { mission });
      },
    },
    {
      method: "POST",
      pathname: "/v1/mission-resolutions:dry-run",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "operator");
        const request = MissionResolutionRequestSchema.parse(readJsonBody(ctx.request.body));
        return buildJsonResponse(ctx.requestId, 200, resolver.resolve(request));
      },
    },
  ];
}

function pickMissionPatch(current: MissionRecord, body: Record<string, unknown>): Partial<MissionRecord> {
  const patch: Partial<MissionRecord> = {};
  if (typeof body["title"] === "string") {
    patch.title = body["title"];
  }
  if (typeof body["description"] === "string" || body["description"] === null) {
    patch.description = body["description"];
  }
  if (typeof body["objective"] === "string") {
    patch.objective = body["objective"];
  }
  if (Array.isArray(body["successCriteria"]) && body["successCriteria"].every((item) => typeof item === "string")) {
    patch.successCriteria = body["successCriteria"] as string[];
  }
  if (body["priority"] === "low" || body["priority"] === "normal" || body["priority"] === "high" || body["priority"] === "critical") {
    patch.priority = body["priority"];
  }
  if (typeof body["accountablePrincipalId"] === "string" || body["accountablePrincipalId"] === null) {
    patch.accountablePrincipalId = body["accountablePrincipalId"];
  }
  if (typeof body["domainId"] === "string" || body["domainId"] === null) {
    patch.domainId = body["domainId"];
  }
  if (Array.isArray(body["policyRefs"]) && body["policyRefs"].every((item) => typeof item === "string")) {
    patch.policyRefs = body["policyRefs"] as string[];
  }
  if (typeof body["riskProfileRef"] === "string" || body["riskProfileRef"] === null) {
    patch.riskProfileRef = body["riskProfileRef"];
  }
  if (typeof body["budgetEnvelopeRef"] === "string" || body["budgetEnvelopeRef"] === null) {
    patch.budgetEnvelopeRef = body["budgetEnvelopeRef"];
  }
  if (typeof body["knowledgeBoundaryRef"] === "string" || body["knowledgeBoundaryRef"] === null) {
    patch.knowledgeBoundaryRef = body["knowledgeBoundaryRef"];
  }
  if (Array.isArray(body["defaultWorkflowTemplateRefs"]) && body["defaultWorkflowTemplateRefs"].every((item) => typeof item === "string")) {
    patch.defaultWorkflowTemplateRefs = body["defaultWorkflowTemplateRefs"] as string[];
  }
  if (body["metadata"] != null && typeof body["metadata"] === "object" && !Array.isArray(body["metadata"])) {
    patch.metadata = body["metadata"] as MissionRecord["metadata"];
  }
  return Object.keys(patch).length === 0 ? { metadata: current.metadata } : patch;
}

function readRole(value: unknown): MissionRole {
  return value === "owner" || value === "admin" || value === "operator" || value === "viewer" || value === "auditor"
    ? value
    : "viewer";
}

function readPermissions(value: unknown): MissionPermission[] {
  if (!Array.isArray(value)) {
    return ["mission:read"];
  }
  return value.filter((item): item is MissionPermission =>
    item === "mission:read"
    || item === "mission:update"
    || item === "mission:manage_members"
    || item === "mission:view_budget"
    || item === "mission:view_evidence"
    || item === "mission:bind_task"
    || item === "mission:execute"
    || item === "mission:handoff"
  );
}

function actionToStatus(action: string | undefined) {
  switch (action) {
    case "activate":
      return "active";
    case "pause":
      return "paused";
    case "resume":
      return "active";
    case "freeze":
      return "frozen";
    case "unfreeze":
      return "paused";
    case "complete":
      return "completed";
    case "archive":
      return "archived";
    default:
      return null;
  }
}
