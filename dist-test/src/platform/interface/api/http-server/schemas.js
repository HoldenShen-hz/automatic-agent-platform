/**
 * @fileoverview HTTP route payload schemas.
 *
 * Centralizes runtime payload parsing for POST routes via Zod schemas so
 * request validation stays consistent across handlers and tests.
 */
import { ArtifactBundleExtendedSchema, ArtifactRecordSchema, } from "../../../state-evidence/artifacts/artifact-model.js";
import { AppError } from "../../../contracts/errors.js";
import { z, ZodError } from "zod";
class ApiError extends AppError {
    constructor(statusCode, code, message) {
        super(code, message, {
            statusCode,
            category: statusCode >= 500 ? "internal" : statusCode >= 400 ? "validation" : "external",
            source: "runtime",
            retryable: statusCode >= 500 || statusCode === 429,
        });
        this.name = "ApiError";
    }
}
function requireNonEmptyString(value, code, message, statusCode = 400) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new ApiError(statusCode, code, message);
    }
    return value.trim();
}
function formatZodIssuePath(path) {
    if (path.length === 0) {
        return "payload";
    }
    return path.map((segment) => String(segment)).join(".");
}
function parseWithApiSchema(schema, body, fallbackCode, fallbackMessage) {
    try {
        return schema.parse(body);
    }
    catch (error) {
        if (error instanceof ZodError) {
            const firstIssue = error.issues[0];
            const path = formatZodIssuePath(firstIssue?.path ?? []);
            const message = firstIssue?.message ?? fallbackMessage;
            throw new ApiError(400, `${fallbackCode}:${path}`, message);
        }
        throw error;
    }
}
const nonEmptyStringSchema = z.string().trim().min(1);
const isoTimestampSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Expected a valid ISO timestamp.",
});
const authTokenBodySchema = z.object({
    apiKey: nonEmptyStringSchema.optional(),
}).strict();
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
function checkDangerousKeys(obj, path = []) {
    if (typeof obj !== "object" || obj === null)
        return;
    for (const key of Object.keys(obj)) {
        if (DANGEROUS_KEYS.has(key)) {
            throw new ApiError(400, "api.dangerous_key", `Reserved key: ${key}`);
        }
        const value = obj[key];
        if (typeof value === "object" && value !== null) {
            checkDangerousKeys(value, [...path, key]);
        }
    }
}
const gatewaySendPayloadSchema = z.object({
    text: nonEmptyStringSchema,
    channel: nonEmptyStringSchema.optional(),
    query: nonEmptyStringSchema.optional(),
    targetId: nonEmptyStringSchema.optional(),
    metadata: z.record(z.unknown()).optional(),
}).strict().superRefine((value, ctx) => {
    try {
        checkDangerousKeys(value);
    }
    catch (err) {
        if (err instanceof AppError) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: err.message });
        }
    }
});
const gatewayWebhookPayloadSchema = z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
    try {
        checkDangerousKeys(value);
    }
    catch (err) {
        if (err instanceof AppError) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: err.message });
        }
    }
});
const approvalDecisionBodySchema = z.object({
    decisionType: z.enum([
        "option_selected",
        "confirmed",
        "text_input",
        "rejected",
        "expired",
    ]),
    respondedAt: isoTimestampSchema.optional(),
    selectedOptionId: nonEmptyStringSchema.optional(),
    inputText: nonEmptyStringSchema.optional(),
}).strict().superRefine((value, ctx) => {
    if (value.decisionType === "option_selected" && value.selectedOptionId == null) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["selectedOptionId"],
            message: "selectedOptionId is required when decisionType=option_selected.",
        });
    }
    if (value.decisionType === "text_input" && value.inputText == null) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["inputText"],
            message: "inputText is required when decisionType=text_input.",
        });
    }
});
const billingReconcilePayloadSchema = z.object({
    gatewayKind: z.enum(["manual", "stripe", "paddle"]),
    gatewaySessionRef: nonEmptyStringSchema,
    status: z.enum(["pending", "paid", "failed", "cancelled"]),
    occurredAt: isoTimestampSchema.optional(),
    failureCode: nonEmptyStringSchema.optional(),
}).strict();
const artifactBundlePreviewPayloadSchema = z.object({
    taskId: nonEmptyStringSchema,
    domainId: nonEmptyStringSchema,
    bundleType: z.enum(["release_bundle", "asset_bundle", "campaign_bundle", "incident_bundle"]),
    artifacts: z.array(ArtifactRecordSchema),
}).strict();
const artifactBundlePublishPayloadSchema = z.object({
    bundle: ArtifactBundleExtendedSchema,
}).strict();
const controlPlaneLoadBalancingSelectionPayloadSchema = z.object({
    queueName: nonEmptyStringSchema.optional(),
    preferredRegion: nonEmptyStringSchema.optional(),
    tenantId: nonEmptyStringSchema.optional(),
    requestKey: nonEmptyStringSchema.optional(),
}).strict();
export function parseAuthTokenPayload(body, headerApiKey) {
    const payload = body == null
        ? {}
        : parseWithApiSchema(authTokenBodySchema, body, "api.invalid_auth_payload", "Auth payload must be an object.");
    const apiKeyCandidate = typeof headerApiKey === "string" && headerApiKey.trim().length > 0
        ? headerApiKey
        : payload.apiKey;
    return {
        apiKey: requireNonEmptyString(apiKeyCandidate, "api.invalid_api_key", "API key is required.", 401),
    };
}
export function parseGatewaySendPayload(body) {
    const payload = parseWithApiSchema(gatewaySendPayloadSchema, body, "api.invalid_gateway_payload", "Gateway payload must be an object.");
    return {
        text: payload.text,
        ...(payload.channel != null ? { channel: payload.channel } : {}),
        ...(payload.query != null ? { query: payload.query } : {}),
        ...(payload.targetId != null ? { targetId: payload.targetId } : {}),
        ...(payload.metadata != null ? { metadata: payload.metadata } : {}),
    };
}
export function parseGatewayWebhookPayload(body) {
    return parseWithApiSchema(gatewayWebhookPayloadSchema, body, "api.invalid_gateway_webhook_payload", "Gateway webhook payload must be a JSON object.");
}
export function parseApprovalDecisionPayload(approvalId, actorId, body) {
    const payload = parseWithApiSchema(approvalDecisionBodySchema, body, "api.invalid_decision_payload", "Decision payload must be an object.");
    const respondedAt = payload.respondedAt;
    const decision = {
        approvalId,
        decisionType: payload.decisionType,
        respondedBy: actorId,
        respondedAt: respondedAt == null
            ? new Date().toISOString()
            : respondedAt,
    };
    if (payload.decisionType === "option_selected") {
        if (payload.selectedOptionId != null) {
            decision.selectedOptionId = payload.selectedOptionId;
        }
    }
    else if (payload.decisionType === "confirmed") {
        decision.confirmed = true;
    }
    else if (payload.decisionType === "text_input") {
        if (payload.inputText != null) {
            decision.inputText = payload.inputText;
        }
    }
    return decision;
}
export function parseBillingReconcilePayload(body) {
    const payload = parseWithApiSchema(billingReconcilePayloadSchema, body, "api.invalid_billing_reconcile_payload", "Billing reconcile payload must be an object.");
    return {
        gatewayKind: payload.gatewayKind,
        gatewaySessionRef: payload.gatewaySessionRef,
        status: payload.status,
        ...(payload.occurredAt != null ? { occurredAt: payload.occurredAt } : {}),
        ...(payload.failureCode != null ? { failureCode: payload.failureCode } : {}),
    };
}
export function parseArtifactBundlePreviewPayload(body) {
    const payload = parseWithApiSchema(artifactBundlePreviewPayloadSchema, body, "api.invalid_artifact_bundle_preview_payload", "Artifact bundle preview payload must be an object.");
    return {
        taskId: payload.taskId,
        domainId: payload.domainId,
        bundleType: payload.bundleType,
        artifacts: payload.artifacts,
    };
}
export function parseArtifactBundlePublishPayload(body) {
    const payload = parseWithApiSchema(artifactBundlePublishPayloadSchema, body, "api.invalid_artifact_bundle_publish_payload", "Artifact bundle publish payload must be an object.");
    return {
        bundle: payload.bundle,
    };
}
export function parseControlPlaneLoadBalancingSelectionPayload(body) {
    const payload = parseWithApiSchema(controlPlaneLoadBalancingSelectionPayloadSchema, body, "api.invalid_control_plane_payload", "Control plane payload must be an object.");
    return {
        ...(payload.queueName != null ? { queueName: payload.queueName } : {}),
        ...(payload.preferredRegion != null ? { preferredRegion: payload.preferredRegion } : {}),
        ...(payload.tenantId != null ? { tenantId: payload.tenantId } : {}),
        ...(payload.requestKey != null ? { requestKey: payload.requestKey } : {}),
    };
}
// ── Task Schemas ──────────────────────────────────────────────────────────────
const createTaskPayloadSchema = z.object({
    title: nonEmptyStringSchema,
    divisionId: nonEmptyStringSchema.optional(),
    parentId: nonEmptyStringSchema.optional(),
    inputJson: z.string().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    source: z.enum(["user", "perception", "system"]).optional(),
}).strict();
const updateTaskPayloadSchema = z.object({
    title: nonEmptyStringSchema.optional(),
    status: z.enum(["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    outputJson: z.string().optional(),
}).strict();
export function parseCreateTaskPayload(body) {
    const payload = parseWithApiSchema(createTaskPayloadSchema, body, "api.invalid_create_task_payload", "Create task payload must be an object.");
    return {
        title: payload.title,
        ...(payload.divisionId != null ? { divisionId: payload.divisionId } : {}),
        ...(payload.parentId != null ? { parentId: payload.parentId } : {}),
        ...(payload.inputJson != null ? { inputJson: payload.inputJson } : {}),
        ...(payload.priority != null ? { priority: payload.priority } : {}),
        ...(payload.source != null ? { source: payload.source } : {}),
    };
}
export function parseUpdateTaskPayload(body) {
    const payload = parseWithApiSchema(updateTaskPayloadSchema, body, "api.invalid_update_task_payload", "Update task payload must be an object.");
    return {
        ...(payload.title != null ? { title: payload.title } : {}),
        ...(payload.status != null ? { status: payload.status } : {}),
        ...(payload.priority != null ? { priority: payload.priority } : {}),
        ...(payload.outputJson != null ? { outputJson: payload.outputJson } : {}),
    };
}
// ── Webhook Schemas ─────────────────────────────────────────────────────────
const createWebhookEndpointSchema = z.object({
    endpointId: nonEmptyStringSchema,
    source: nonEmptyStringSchema,
    allowedEventTypes: z.array(z.string()).optional(),
    algorithm: z.enum(["none", "sha256_hmac"]).optional(),
    signingSecret: z.string().optional(),
    signatureHeader: z.string().optional(),
    idempotencyHeader: z.string().optional(),
    dispatchTargetRef: nonEmptyStringSchema.optional(),
    enabled: z.boolean().optional(),
}).strict();
export function parseCreateWebhookEndpointPayload(body) {
    const payload = parseWithApiSchema(createWebhookEndpointSchema, body, "api.invalid_webhook_endpoint_payload", "Webhook endpoint payload must be an object.");
    return {
        endpointId: payload.endpointId,
        source: payload.source,
        ...(payload.allowedEventTypes != null ? { allowedEventTypes: payload.allowedEventTypes } : {}),
        ...(payload.algorithm != null ? { algorithm: payload.algorithm } : {}),
        ...(payload.signingSecret != null ? { signingSecret: payload.signingSecret } : {}),
        ...(payload.signatureHeader != null ? { signatureHeader: payload.signatureHeader } : {}),
        ...(payload.idempotencyHeader != null ? { idempotencyHeader: payload.idempotencyHeader } : {}),
        ...(payload.dispatchTargetRef != null ? { dispatchTargetRef: payload.dispatchTargetRef } : {}),
        ...(payload.enabled != null ? { enabled: payload.enabled } : {}),
    };
}
//# sourceMappingURL=schemas.js.map