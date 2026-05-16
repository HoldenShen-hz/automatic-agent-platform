import type { ArtifactPlaneService } from "../../../five-plane-state-evidence/artifacts/artifact-plane-service.js";
import type { KnowledgePlaneService } from "../../../five-plane-state-evidence/knowledge/knowledge-plane-service.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import type { DomainRegistryService, PluginSpiRegistry } from "../api-external-support.js";
import {
  parseArtifactBundlePreviewPayload,
  parseArtifactBundlePublishPayload,
} from "./schemas.js";
import type { RouteDefinition } from "./types.js";
import { buildJsonResponse, requirePrincipal, readLimit, readQueryParam } from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";

export interface PlaneRouteDeps {
  authService: ApiAuthService | null;
  knowledgePlaneService?: KnowledgePlaneService | null;
  domainRegistryService?: DomainRegistryService | null;
  pluginRegistry?: PluginSpiRegistry | null;
  artifactPlaneService?: ArtifactPlaneService | null;
}

function buildNotEnabled(requestId: string, capability: string) {
  return buildJsonResponse(requestId, 200, {
    status: "not_enabled",
    capability,
  });
}

function decodePathSegment(segment: string): string {
  return decodeURIComponent(segment);
}

export function createPlaneRoutes(deps: PlaneRouteDeps): RouteDefinition[] {
  return [
    {
      method: "GET",
      pathname: "/v1/knowledge/namespaces",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        if (!deps.knowledgePlaneService) {
          return buildNotEnabled(ctx.requestId, "knowledge_plane");
        }
        return buildJsonResponse(ctx.requestId, 200, {
          namespaces: deps.knowledgePlaneService.listNamespaces(),
        });
      },
    },
    {
      method: "GET",
      pathname: "/v1/knowledge/query",
      handler: async (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        if (!deps.knowledgePlaneService) {
          return buildNotEnabled(ctx.requestId, "knowledge_plane");
        }
        const q = readQueryParam(ctx.request, "q", { maxLength: 512 }) ?? "";
        const namespace = readQueryParam(ctx.request, "namespace", { maxLength: 128, pattern: /^[a-zA-Z0-9._:/-]+$/ });
        const domainId = readQueryParam(ctx.request, "domainId", { maxLength: 128, pattern: /^[a-zA-Z0-9._:-]+$/ });
        const limit = Math.min(readLimit(ctx.request, 10), 50);
        if (q.length === 0) {
          return buildJsonResponse(ctx.requestId, 200, {
            hits: [],
          });
        }
        const hits = domainId
          ? await deps.knowledgePlaneService.queryForDomain(q, {
              domainId,
              ...(namespace ? { namespace } : {}),
              limit,
              includePluginRetrieval: true,
            })
          : await deps.knowledgePlaneService.queryAsync(q, {
              ...(namespace ? { namespace } : {}),
              limit,
            });
        return buildJsonResponse(ctx.requestId, 200, { hits });
      },
    },
    {
      method: "GET",
      pathname: "/v1/knowledge/graph",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        if (!deps.knowledgePlaneService) {
          return buildNotEnabled(ctx.requestId, "knowledge_plane");
        }
        const namespace = readQueryParam(ctx.request, "namespace", { maxLength: 128, pattern: /^[a-zA-Z0-9._:/-]+$/ });
        const knowledgeRef = readQueryParam(ctx.request, "knowledgeRef", { maxLength: 256, pattern: /^[a-zA-Z0-9._:/-]+$/ });
        const keyword = readQueryParam(ctx.request, "keyword", { maxLength: 128 });
        const limit = Math.min(readLimit(ctx.request, 20), 100);
        return buildJsonResponse(ctx.requestId, 200, deps.knowledgePlaneService.inspectGraph({
          ...(namespace ? { namespace } : {}),
          ...(knowledgeRef ? { knowledgeRef } : {}),
          ...(keyword ? { keyword } : {}),
          limit,
        }));
      },
    },
    {
      method: "GET",
      pathname: "/v1/knowledge/semantic/inspect",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        if (!deps.knowledgePlaneService) {
          return buildNotEnabled(ctx.requestId, "knowledge_plane");
        }
        return buildJsonResponse(ctx.requestId, 200, deps.knowledgePlaneService.inspectSemanticInfrastructure());
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "v1"
          || segments[1] !== "knowledge"
          || segments.length !== 4
          || segments[3] !== "inspect"
        ) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        if (!deps.knowledgePlaneService) {
          return buildNotEnabled(ctx.requestId, "knowledge_plane");
        }
        const namespaceSegment = segments[2];
        if (namespaceSegment == null) {
          return null;
        }
        const namespace = decodePathSegment(namespaceSegment);
        return buildJsonResponse(ctx.requestId, 200, deps.knowledgePlaneService.inspectNamespace(namespace));
      },
    },
    {
      method: "GET",
      pathname: "/v1/domains",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        if (!deps.domainRegistryService) {
          return buildNotEnabled(ctx.requestId, "domain_registry");
        }
        return buildJsonResponse(ctx.requestId, 200, {
          domains: deps.domainRegistryService.list(),
        });
      },
    },
    {
      method: "GET",
      pathname: "/v1/plugins",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        if (!deps.pluginRegistry) {
          return buildNotEnabled(ctx.requestId, "plugin_spi_registry");
        }
        return buildJsonResponse(ctx.requestId, 200, {
          plugins: deps.pluginRegistry.list().map((record) => ({
            manifest: record.manifest,
            lifecycleState: record.lifecycleState,
            lastHealthCheckAt: record.lastHealthCheckAt,
            failureCount: record.failureCount,
            lastErrorMessage: record.lastErrorMessage,
            lastErrorAt: record.lastErrorAt,
            disabledReason: record.disabledReason,
            cooldownUntil: record.cooldownUntil,
            activeInvocationCount: record.activeInvocationCount,
            queuedInvocationCount: record.queuedInvocationCount,
            lastInvocationStartedAt: record.lastInvocationStartedAt,
            lastInvocationCompletedAt: record.lastInvocationCompletedAt,
            runtimeProcessId: record.runtimeProcessId,
            runtimeSandboxRoot: record.runtimeSandboxRoot,
          })),
        });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (segments[0] !== "v1" || segments[1] !== "domains" || segments.length !== 3) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        if (!deps.domainRegistryService) {
          return buildNotEnabled(ctx.requestId, "domain_registry");
        }
        const domainIdSegment = segments[2];
        if (domainIdSegment == null) {
          return null;
        }
        const domainId = decodePathSegment(domainIdSegment);
        return buildJsonResponse(ctx.requestId, 200, {
          domain: deps.domainRegistryService.get(domainId),
          capabilityEntry: deps.domainRegistryService.get(domainId) ? deps.domainRegistryService.buildCapabilityEntry(domainId) : null,
        });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "v1"
          || segments[1] !== "domains"
          || segments.length !== 4
          || segments[3] !== "plugins"
        ) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        if (!deps.domainRegistryService || !deps.pluginRegistry) {
          return buildNotEnabled(ctx.requestId, "domain_plugin_registry");
        }
        const domainIdSegment = segments[2];
        if (domainIdSegment == null) {
          return null;
        }
        const domainId = decodePathSegment(domainIdSegment);
        return buildJsonResponse(ctx.requestId, 200, {
          bindings: deps.domainRegistryService.getPluginBindings(domainId),
          plugins: deps.pluginRegistry.listByDomain(domainId).map((record) => ({
            manifest: record.manifest,
            lifecycleState: record.lifecycleState,
            failureCount: record.failureCount,
            lastErrorMessage: record.lastErrorMessage,
            cooldownUntil: record.cooldownUntil,
            activeInvocationCount: record.activeInvocationCount,
            queuedInvocationCount: record.queuedInvocationCount,
            runtimeProcessId: record.runtimeProcessId,
            runtimeSandboxRoot: record.runtimeSandboxRoot,
          })),
        });
      },
    },
    {
      method: "GET",
      pathname: "/v1/artifacts/publishes",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        if (!deps.artifactPlaneService) {
          return buildNotEnabled(ctx.requestId, "artifact_plane");
        }
        return buildJsonResponse(ctx.requestId, 200, {
          publishes: deps.artifactPlaneService.listPublishHistory(),
        });
      },
    },
    {
      method: "POST",
      pathname: "/v1/artifacts/bundles/preview",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "operator");
        if (!deps.artifactPlaneService) {
          return buildNotEnabled(ctx.requestId, "artifact_plane");
        }
        const payload = readValidatedJsonBody(
          ctx.request.body,
          parseArtifactBundlePreviewPayload,
        );
        const result = deps.artifactPlaneService.prepareBundle({
          taskId: payload.taskId,
          domainId: payload.domainId,
          bundleType: payload.bundleType,
          artifacts: payload.artifacts,
        });
        return buildJsonResponse(ctx.requestId, 200, result);
      },
    },
    {
      method: "POST",
      pathname: "/v1/artifacts/bundles/publish",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "operator");
        if (!deps.artifactPlaneService) {
          return buildNotEnabled(ctx.requestId, "artifact_plane");
        }
        const payload = readValidatedJsonBody(
          ctx.request.body,
          parseArtifactBundlePublishPayload,
        );
        const result = deps.artifactPlaneService.publishBundle(payload.bundle);
        return buildJsonResponse(ctx.requestId, 200, result);
      },
    },
  ];
}
