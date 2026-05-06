import type { PromptBundleRegistrationInput } from "../../../contracts/prompt-bundle/index.js";
import type { HierarchicalPromptRegistryService } from "../../../prompt-engine/registry/hierarchical-registry-service.js";
import type { ApiAuthService } from "../api-auth-service.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import type { RouteDefinition } from "./types.js";
import { buildJsonErrorResponse, buildJsonResponse, readLimit, readQueryParam, requirePrincipal } from "./utils.js";
import { z } from "zod";

const promptBundleRequestSchema = z.object({
  level: z.enum(["global", "domain", "pack", "task-type"]).optional(),
  domain: z.string().optional(),
  packId: z.string().optional(),
}).strict();

const promptBundleRegistrationSchema = z.object({
  level: z.enum(["global", "domain", "pack", "task-type"]).optional(),
  version: z.number().int().positive().optional(),
  displayVersion: z.string().min(1).optional(),
  domain: z.string().min(1).optional(),
  taskType: z.string().min(1).optional(),
  packId: z.string().optional(),
  name: z.string().min(1),
  promptText: z.string(),
  model: z.enum(["reasoning", "coding", "balanced", "fast"]),
  tools: z.array(z.string()),
  maxInstances: z.number().int().positive().optional(),
  scope: z.object({
    responsibilities: z.array(z.string()),
    boundaries: z.array(z.string()),
  }),
  inputSchema: z.object({
    required: z.array(z.string()),
    optional: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    required: z.array(z.string()),
    optional: z.array(z.string()).optional(),
  }),
  preconditions: z.array(z.object({
    check: z.string(),
    description: z.string(),
  })),
}).strict();

const promptBundleDeprecationSchema = z.object({
  level: z.enum(["global", "domain", "pack", "task-type"]).optional(),
  domain: z.string().min(1).optional(),
  packId: z.string().min(1).optional(),
  version: z.number().int().positive(),
}).strict();

function toPromptBundleRegistrationInput(
  payload: z.infer<typeof promptBundleRegistrationSchema>,
): PromptBundleRegistrationInput {
  const version = payload.version ?? 1;
  const domain = payload.domain ?? "global";
  const modelId =
    payload.model === "reasoning"
      ? "reasoning/default"
      : payload.model === "coding"
        ? "coding/default"
        : payload.model === "balanced"
          ? "balanced/default"
          : "fast/default";

  return {
    name: payload.name,
    version,
    displayVersion: payload.displayVersion ?? `v${version}`,
    domain,
    taskType: payload.taskType ?? payload.name,
    packId: payload.packId,
    systemPrompt: {
      content: payload.promptText,
      templateVariables: payload.inputSchema.required,
      channel: "system",
    },
    userPrompt: undefined,
    fewShotExamples: [],
    constraints: {
      maxTokens: payload.maxInstances,
      temperature: undefined,
      topP: undefined,
      stopSequences: undefined,
      responseFormat: "json",
      customConstraints: {
        responsibilities: payload.scope.responsibilities,
        boundaries: payload.scope.boundaries,
        tools: payload.tools,
        preconditions: payload.preconditions,
        outputSchema: payload.outputSchema,
      },
    },
    compatibilityMatrix: {
      toolSchemaVersions: payload.tools.map((toolName) => ({ toolName, schemaVersion: 1 })),
      evaluatorSchemaVersions: [],
      domainDescriptorVersions: [{ domainId: domain, version: 1 }],
      modelRoutingProfiles: [{ modelId, profileVersion: 1 }],
    },
    metadata: {
      owner: "api",
      deprecated: false,
      lifecycleStatus: "draft",
      tags: [],
      compatibilityTags: [],
      trafficAllocation: {
        weight: 100,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
  };
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
        const level = readQueryParam(ctx.request, "level", { maxLength: 32 }) as "global" | "domain" | "pack" | undefined;
        const domain = readQueryParam(ctx.request, "domain", { maxLength: 128 });
        const packId = readQueryParam(ctx.request, "packId", { maxLength: 128 });
        const prompts = deps.promptRegistryService.listBundles(level, domain, packId);
        return buildJsonResponse(ctx.requestId, 200, {
          prompts: prompts.slice(0, limit),
          total: prompts.length,
        });
      },
    },
    {
      method: "POST",
      pathname: "/v1/prompts",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "operator");
        const payload = readValidatedJsonBody(ctx.request.body, promptBundleRegistrationSchema.parse);
        const registrationInput = toPromptBundleRegistrationInput(payload);
        const bundle = deps.promptRegistryService.registerBundle(
          registrationInput,
          payload.level ?? "global",
          payload.domain,
          payload.packId,
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
        if (!bundle) {
          return buildJsonErrorResponse(ctx.requestId, 404, {
            code: "prompt.bundle_not_found",
            message: `Bundle ${name} not found.`,
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
        const domain = payload.domain;
        const packId = payload.packId;
        const version = payload.version;
        try {
          deps.promptRegistryService.deprecateBundle(name, version, level, domain, packId);
        } catch {
          return buildJsonErrorResponse(ctx.requestId, 404, {
            code: "prompt.bundle_not_found",
            message: `Bundle ${name} not found.`,
          });
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
        const level = (readQueryParam(ctx.request, "level", { maxLength: 32 }) as "global" | "domain" | "pack" | "task-type" | undefined) ?? "global";
        const versionParam = readQueryParam(ctx.request, "version", { required: true, maxLength: 64 })!;
        const version = Number(versionParam);
        if (!Number.isInteger(version) || version <= 0) {
          return buildJsonResponse(ctx.requestId, 400, { error: { code: "prompt.invalid_version", message: "version must be a positive integer." } });
        }
        const domain = readQueryParam(ctx.request, "domain", { maxLength: 128 });
        const packId = readQueryParam(ctx.request, "packId", { maxLength: 128 });
        const removed = deps.promptRegistryService.removeBundle(name, version, level, domain, packId);
        return buildJsonResponse(ctx.requestId, removed ? 200 : 404, { removed, name, version });
      },
    },
  ];
}
