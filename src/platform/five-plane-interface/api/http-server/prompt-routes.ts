import type { HierarchicalPromptRegistryService } from "../../../prompt-engine/registry/hierarchical-registry-service.js";
import type { ApiAuthService } from "../api-auth-service.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import type { RouteDefinition } from "./types.js";
import {
  buildJsonErrorResponse,
  buildJsonResponse,
  decodeOpaqueCursor,
  encodeOpaqueCursor,
  readCursor,
  readLimit,
  readQueryParam,
  requirePrincipal,
} from "./utils.js";
import { z } from "zod";

const promptBundleRegistrationSchema = z.object({
  name: z.string().optional(),
  version: z.union([z.number(), z.string()]).optional(),
  displayVersion: z.string().optional(),
  taskType: z.string().optional(),
  systemPrompt: z.string().optional(),
  userPrompt: z.string().optional(),
  level: z.enum(["global", "domain", "task-type"]).optional(),
  domain: z.string().optional(),
  packId: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).strict();

const promptBundleDeprecationSchema = z.object({
  version: z.union([z.number(), z.string()]),
  level: z.enum(["global", "domain", "task-type"]).optional(),
  domain: z.string().optional(),
  packId: z.string().optional(),
}).strict();

type PromptBundleRequestPayload = z.infer<typeof promptBundleRegistrationSchema>;

interface PromptCursor {
  readonly createdAt: string;
  readonly bundleId: string;
}

export interface PromptRouteDeps {
  authService: ApiAuthService | null;
  promptRegistryService: HierarchicalPromptRegistryService;
}

export function createPromptRoutes(deps: PromptRouteDeps): RouteDefinition[] {
  return [
    {
      method: "GET",
      pathname: "/v1/prompts",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const limit = readLimit(ctx.request, 50);
        const level = readQueryParam(ctx.request, "level", { maxLength: 32 }) as "global" | "domain" | "task-type" | undefined;
        const domain = readQueryParam(ctx.request, "domain", { maxLength: 128 });
        const packId = readQueryParam(ctx.request, "packId", { maxLength: 128 });
        const allPrompts = deps.promptRegistryService.listBundles(level, domain, packId);
        const sorted = [...allPrompts].sort((left, right) =>
          right.bundle.createdAt.localeCompare(left.bundle.createdAt) ||
          left.bundle.bundleId.localeCompare(right.bundle.bundleId)
        );
        const cursorStr = readCursor(ctx.request);
        const decodedCursor = cursorStr == null ? null : decodeOpaqueCursor<PromptCursor>(cursorStr);
        const startIndex = cursorStr == null
          ? 0
          : sorted.findIndex((item) =>
              decodedCursor != null &&
              item.bundle.createdAt === decodedCursor.createdAt &&
              item.bundle.bundleId === decodedCursor.bundleId
            );
        const normalizedStart = cursorStr == null ? 0 : startIndex < 0 ? sorted.length : startIndex + 1;
        const pageItems = sorted.slice(normalizedStart, normalizedStart + limit);
        const hasMore = normalizedStart + limit < sorted.length;
        const nextCursor = hasMore && pageItems.length > 0
          ? encodeOpaqueCursor({
              createdAt: pageItems.at(-1)?.bundle.createdAt ?? "",
              bundleId: pageItems.at(-1)?.bundle.bundleId ?? "",
            })
          : null;
        const response: Record<string, unknown> = { prompts: pageItems };
        if (nextCursor != null) {
          response.nextCursor = nextCursor;
        }
        return buildJsonResponse(ctx.requestId, 200, response);
      },
    },
    {
      method: "POST",
      pathname: "/v1/prompts",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "operator");
        const rawPayload = readValidatedJsonBody(ctx.request.body, promptBundleRegistrationSchema.parse);
        const level = rawPayload.level ?? "global";
        const bundle = deps.promptRegistryService.registerBundle(
          {
            name: rawPayload.name ?? rawPayload.packId ?? "unnamed",
            version: rawPayload.version ?? 1,
            displayVersion: rawPayload.displayVersion ?? "1.0.0",
            taskType: rawPayload.taskType ?? "general",
            systemPrompt: { content: rawPayload.systemPrompt ?? "", templateVariables: [], channel: "system" },
            userPrompt: rawPayload.userPrompt ? { content: rawPayload.userPrompt, templateVariables: [], channel: "user" } : undefined,
            domain: rawPayload.domain ?? "",
            packId: rawPayload.packId,
            fewShotExamples: undefined,
            constraints: undefined,
            compatibilityMatrix: { toolSchemaVersions: [], evaluatorSchemaVersions: [], domainDescriptorVersions: [], modelRoutingProfiles: [] },
            metadata: undefined,
          },
          level,
          rawPayload.domain,
          rawPayload.packId,
        );
        return buildJsonResponse(ctx.requestId, 201, { bundle });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        if (ctx.route.segments.length !== 3 || ctx.route.segments[0] !== "v1" || ctx.route.segments[1] !== "prompts") {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const name = decodeURIComponent(ctx.route.segments[2] ?? "");
        const taskType = readQueryParam(ctx.request, "taskType", { required: true, maxLength: 128 })!;
        const domain = readQueryParam(ctx.request, "domain", { maxLength: 128 });
        const packId = readQueryParam(ctx.request, "packId", { maxLength: 128 });
        const bundle = deps.promptRegistryService.getBundle(name, taskType, packId, domain);
        if (bundle == null) {
          return buildJsonErrorResponse(ctx.requestId, 404, {
            code: "api.prompt_bundle_not_found",
            message: `Prompt bundle ${name} was not found.`,
            details: { name, taskType, domain, packId },
          });
        }
        return buildJsonResponse(ctx.requestId, 200, { bundle });
      },
    },
    {
      method: "PUT",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        if (ctx.route.segments.length !== 4 || ctx.route.segments[0] !== "v1" || ctx.route.segments[1] !== "prompts" || ctx.route.segments[3] !== "deprecate") {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "operator");
        const name = decodeURIComponent(ctx.route.segments[2] ?? "");
        const payload = readValidatedJsonBody(ctx.request.body, promptBundleDeprecationSchema.parse);
        const level = payload.level ?? "global";
        try {
          deps.promptRegistryService.deprecateBundle(
            name,
            payload.version,
            level,
            payload.domain,
            payload.packId,
          );
        } catch (error) {
          if (
            typeof error === "object"
            && error !== null
            && "code" in error
            && error.code === "prompt_bundle.not_found"
          ) {
            return buildJsonErrorResponse(ctx.requestId, 404, {
              code: "api.prompt_bundle_not_found",
              message: `Prompt bundle ${name}@${payload.version} was not found.`,
              details: { name, version: payload.version, level, domain: payload.domain, packId: payload.packId },
            });
          }
          throw error;
        }
        return buildJsonResponse(ctx.requestId, 200, { deprecated: true, name });
      },
    },
    {
      method: "DELETE",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        if (ctx.route.segments.length !== 3 || ctx.route.segments[0] !== "v1" || ctx.route.segments[1] !== "prompts") {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "admin");
        const name = decodeURIComponent(ctx.route.segments[2] ?? "");
        const level = (readQueryParam(ctx.request, "level", { maxLength: 32 }) as "global" | "domain" | "task-type" | undefined) ?? "global";
        const version = readQueryParam(ctx.request, "version", { required: true, maxLength: 64 })!;
        const domain = readQueryParam(ctx.request, "domain", { maxLength: 128 });
        const packId = readQueryParam(ctx.request, "packId", { maxLength: 128 });
        const removed = deps.promptRegistryService.removeBundle(name, version, level, domain, packId);
        return buildJsonResponse(ctx.requestId, removed ? 200 : 404, { removed, name, version });
      },
    },
  ];
}
