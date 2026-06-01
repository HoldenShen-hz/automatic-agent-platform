import type { ExternalAdapterPlugin } from "../../domains/registry/plugin-spi.js";
import { PolicyDeniedError } from "../../platform/contracts/errors.js";
import { NetworkEgressPolicyService } from "../../platform/five-plane-control-plane/iam/network-egress-policy.js";
import { parseSafeOutboundUrl } from "../../platform/five-plane-control-plane/iam/outbound-url-policy.js";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createZeroableCredentialSecret, type ZeroableCredentialSecret } from "./credential-hygiene.js";

// R8-25 FIX: Plugin signature verification for secure plugin loading

export interface GithubAdapterPluginOptions {
  apiBaseUrl?: string;
  policy?: NetworkEgressPolicyService;
  signatureKey?: string;
  defaultTimeoutMs?: number;
  defaultRateLimitPerMinute?: number;
  fetchImplementation?: typeof fetch;
  maxResponseSizeBytes?: number;
  healthProbe?: (input: { readonly apiBaseUrl: string; readonly credentialFingerprint: string | null }) => Promise<boolean> | boolean;
}

/**
 * R8-25 FIX: Plugin signature verification result
 */
export interface PluginSignatureVerificationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly verifiedAt: string;
}

const ACTION_CAPABILITY_MAP = {
  create_issue: "external.github.issue",
  create_pr_comment: "external.github.issue",
  dispatch_workflow: "external.github.workflow",
  get_file: "external.github",
} as const satisfies Record<string, string>;

/**
 * R8-25 FIX: Verify plugin manifest signature for secure loading.
 * Uses HMAC-SHA256 for integrity verification.
 */
export function verifyPluginSignature(
  pluginId: string,
  manifestHash: string,
  signature: string,
  secretKey: string,
): PluginSignatureVerificationResult {
  const verifiedAt = new Date().toISOString();

  if (!secretKey) {
    return { valid: false, error: "plugin_signature.verification_key_missing", verifiedAt };
  }

  if (!signature) {
    return { valid: false, error: "plugin_signature.signature_missing", verifiedAt };
  }

  try {
    const expectedSignature = createHmac("sha256", secretKey)
      .update(`${pluginId}:${manifestHash}`)
      .digest("hex");

    const provided = Buffer.from(signature, "hex");
    const expected = Buffer.from(expectedSignature, "hex");
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return { valid: false, error: "plugin_signature.invalid", verifiedAt };
    }

    return { valid: true, verifiedAt };
  } catch (err) {
    return {
      valid: false,
      error: `plugin_signature.verification_error: ${err instanceof Error ? err.message : "unknown"}`,
      verifiedAt,
    };
  }
}

/**
 * R8-25 FIX: Create a signed plugin manifest hash for verification.
 */
export function createPluginManifestHash(pluginId: string, manifest: Record<string, unknown>): string {
  return createHash("sha256")
    .update(`${pluginId}:${JSON.stringify(manifest)}`)
    .digest("hex");
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`github_adapter.missing_${field}`);
  }
  return value.trim();
}

function normalizeApiBaseUrl(value: string | undefined): string {
  const parsed = parseSafeOutboundUrl((value ?? "https://api.github.com").trim(), {
    invalid: "github_adapter.invalid_api_base_url",
    blocked: "github_adapter.blocked_api_base_url",
  });
  if (parsed.protocol !== "https:") {
    throw new Error("github_adapter.invalid_api_base_url_protocol");
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString().replace(/\/+$/, "");
}

function buildCredentialFingerprint(token: string): string {
  const prefix = token.startsWith("secret://") ? "secret-ref" : "token";
  return `${prefix}:${createHash("sha256").update(token).digest("hex").slice(0, 16)}`;
}

function requireIssueNumber(value: unknown): string {
  const issueNumber = requireString(value, "issueNumber");
  if (!/^\d+$/.test(issueNumber)) {
    throw new Error("github_adapter.invalid_issue_number");
  }
  return issueNumber;
}

function isPrimitiveWorkflowInput(value: unknown): value is string | number | boolean | null {
  return value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function sanitizeWorkflowInputs(value: unknown): Record<string, string> {
  if (value == null) {
    return {};
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("github_adapter.invalid_workflow_inputs");
  }
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(key) || !isPrimitiveWorkflowInput(entry)) {
      throw new Error("github_adapter.invalid_workflow_inputs");
    }
    result[key] = entry == null ? "" : String(entry);
  }
  return result;
}

function redactSensitiveValue(key: string, value: unknown): unknown {
  return /(token|secret|credential|password|key)$/i.test(key) ? "[REDACTED]" : value;
}

function canonicalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeForHash(item));
  }
  if (value != null && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(objectValue)
        .sort()
        .map((key) => [key, canonicalizeForHash(redactSensitiveValue(key, objectValue[key]))]),
    );
  }
  return value;
}

function createIdempotencyKey(action: string, repository: string, params: Record<string, unknown>): string | undefined {
  if (action === "get_file") {
    // Read-only file fetches are naturally idempotent and do not need an explicit key.
    return undefined;
  }
  return createHash("sha256")
    .update(JSON.stringify({
      action,
      repository,
      params: canonicalizeForHash(params),
    }))
    .digest("hex");
}

function requireRepository(value: unknown): string {
  const repository = requireString(value, "repository");
  const normalized = repository.trim();
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized)
    || normalized.includes("\\")
    || normalized.includes("..")
    || normalized.includes("%2f")
    || normalized.includes("%2F")
    || normalized.includes("%5c")
    || normalized.includes("%5C")
    || normalized.includes("%2e")
    || normalized.includes("%2E")
  ) {
    throw new Error("github_adapter.invalid_repository");
  }
  return normalized;
}

function requirePathSegment(value: unknown, field: string): string {
  const segment = requireString(value, field);
  if (
    /[\\/]/.test(segment)
    || segment === "."
    || segment === ".."
    || segment.includes("..")
    || /%2f|%5c|%2e/i.test(segment)
  ) {
    throw new Error(`github_adapter.invalid_${field}`);
  }
  return segment;
}

function assertActionAllowed(capabilityIds: readonly string[] | undefined, action: string): void {
  const requiredCapability = ACTION_CAPABILITY_MAP[action as keyof typeof ACTION_CAPABILITY_MAP];
  if (requiredCapability == null) {
    throw new Error(`github_adapter.unsupported_action:${action}`);
  }
  const allowedCapabilities = new Set(capabilityIds ?? []);
  if (!allowedCapabilities.has(requiredCapability)) {
    throw new Error(`github_adapter.action_not_allowed:${action}`);
  }
}

interface GithubRequestDetails {
  readonly method: "GET" | "POST";
  readonly endpoint: string;
  readonly payload?: Record<string, unknown>;
}

async function readResponseTextWithLimit(
  response: Partial<Pick<Response, "body" | "headers" | "text">>,
  maxResponseSizeBytes: number,
): Promise<string> {
  const headerLength = typeof response.headers?.get === "function"
    ? response.headers.get("content-length")
    : null;
  if (headerLength != null) {
    const parsedLength = Number(headerLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxResponseSizeBytes) {
      throw new Error("github_adapter.response_too_large");
    }
  }
  if (response.body == null) {
    if (typeof response.text === "function") {
      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > maxResponseSizeBytes) {
        throw new Error("github_adapter.response_too_large");
      }
      return text;
    }
    return "";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let result = "";
  return reader.read().then(function pump(chunk): Promise<string> {
    if (chunk.done) {
      result += decoder.decode();
      return Promise.resolve(result);
    }
    totalBytes += chunk.value.byteLength;
    if (totalBytes > maxResponseSizeBytes) {
      void reader.cancel();
      throw new Error("github_adapter.response_too_large");
    }
    result += decoder.decode(chunk.value, { stream: true });
    return reader.read().then(pump);
  });
}

async function performGithubFetch(params: {
  fetchImplementation: typeof fetch;
  request: GithubRequestDetails;
  credentialSecret: ZeroableCredentialSecret;
  defaultTimeoutMs: number;
  maxResponseSizeBytes: number;
}): Promise<{ readonly status: number; readonly data: unknown }> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(new Error("github_adapter.timeout")), params.defaultTimeoutMs);
  try {
    const response = await params.credentialSecret.withSecret((token) =>
      params.fetchImplementation(params.request.endpoint, {
        method: params.request.method,
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        ...(params.request.payload === undefined ? {} : { body: JSON.stringify(params.request.payload) }),
        signal: controller.signal,
      }),
    );
    const responseText = await readResponseTextWithLimit(response, params.maxResponseSizeBytes);
    if (!response.ok) {
      throw new Error(`github_adapter.api_error:${response.status}:${responseText || "unknown"}`);
    }
    return {
      status: response.status,
      data: responseText.length === 0 ? {} : JSON.parse(responseText) as unknown,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export function createGithubAdapterPlugin(options: GithubAdapterPluginOptions = {}): ExternalAdapterPlugin {
  const apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl);
  const policy = options.policy ?? new NetworkEgressPolicyService({
    mode: "enforce",
    allowedDomains: ["api.github.com", "github.com"],
  });
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 10_000;
  const defaultRateLimitPerMinute = options.defaultRateLimitPerMinute ?? 60;
  const maxResponseSizeBytes = options.maxResponseSizeBytes ?? 1024 * 1024;
  let credentialFingerprint: string | null = null;
  let credentialSecret: ZeroableCredentialSecret | null = null;

  return {
    pluginId: "plugin.shared.github_adapter",
    spiType: "adapter",
    adapterType: "github",
    capabilityIds: ["external.github", "external.github.issue", "external.github.workflow"],
    async initialize() {
      return undefined;
    },
    async healthCheck() {
      if (credentialFingerprint == null) {
        return false;
      }
      if (!policy.evaluate(`${apiBaseUrl}/rate_limit`).allowed) {
        return false;
      }
      if (options.healthProbe != null) {
        return await options.healthProbe({ apiBaseUrl, credentialFingerprint });
      }
      return true;
    },
    async shutdown() {
      credentialFingerprint = null;
      credentialSecret?.clear();
      credentialSecret = null;
    },
    async authenticate(credentials) {
      const token = requireString(credentials["token"] ?? credentials["managedSecretRef"], "token");
      credentialSecret?.clear();
      credentialSecret = createZeroableCredentialSecret(token);
      credentialFingerprint = buildCredentialFingerprint(token);
    },
    async execute(action, params) {
      if (credentialFingerprint == null || credentialSecret == null) {
        throw new Error("github_adapter.not_authenticated");
      }
      assertActionAllowed(this.capabilityIds, action);
      const repository = requireRepository(params["repository"]);
      const request = buildRequest(apiBaseUrl, action, repository, params);
      const decision = policy.evaluate(request.endpoint);
      if (!decision.allowed) {
        throw new PolicyDeniedError(
          decision.reasonCode ?? "github_adapter.egress_blocked",
          `Network egress denied for ${request.endpoint}`,
          {
            category: "policy",
            source: "internal",
            details: {
              action,
              endpoint: request.endpoint,
              destination: decision.destination,
              reasonCode: decision.reasonCode,
            },
          },
        );
      }
      const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
      if (typeof fetchImplementation !== "function") {
        throw new Error("github_adapter.fetch_unavailable");
      }
      const idempotencyKey = createIdempotencyKey(action, repository, params);
      const startTime = Date.now();
      const response = await performGithubFetch({
        fetchImplementation,
        request,
        credentialSecret,
        defaultTimeoutMs,
        maxResponseSizeBytes,
      });
      return {
        adapter: "github",
        action,
        repository,
        method: request.method,
        endpoint: request.endpoint,
        credentialFingerprint,
        timeoutMs: defaultTimeoutMs,
        rateLimitPerMinute: defaultRateLimitPerMinute,
        retryPolicy: { maxRetries: 3, backoffMs: 250 },
        ok: true,
        status: response.status,
        data: response.data,
        latencyMs: Date.now() - startTime,
        ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
        ...(request.payload === undefined ? {} : { payload: request.payload }),
      };
    },
  };
}

function encodeRepositoryPath(path: string): string {
  if (path.trim().length === 0) {
    throw new Error("github_adapter.missing_path");
  }
  const segments = path.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new Error("github_adapter.invalid_path");
  }
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

function buildRequest(apiBaseUrl: string, action: string, repository: string, params: Record<string, unknown>): GithubRequestDetails {
  switch (action) {
    case "create_issue":
      return {
        method: "POST",
        endpoint: `${apiBaseUrl}/repos/${repository}/issues`,
        payload: buildPayload(action, params),
      };
    case "create_pr_comment":
      return {
        method: "POST",
        endpoint: `${apiBaseUrl}/repos/${repository}/issues/${requireIssueNumber(params["issueNumber"])}/comments`,
        payload: buildPayload(action, params),
      };
    case "dispatch_workflow":
      return {
        method: "POST",
        endpoint: `${apiBaseUrl}/repos/${repository}/actions/workflows/${encodeURIComponent(requirePathSegment(params["workflowId"], "workflowId"))}/dispatches`,
        payload: buildPayload(action, params),
      };
    case "get_file": {
      const endpoint = new URL(`${apiBaseUrl}/repos/${repository}/contents/${encodeRepositoryPath(requireString(params["path"], "path"))}`);
      endpoint.searchParams.set("ref", typeof params["ref"] === "string" ? params["ref"] : "main");
      return {
        method: "GET",
        endpoint: endpoint.toString(),
      };
    }
    default:
      throw new Error(`github_adapter.unsupported_action:${action}`);
  }
}

function buildPayload(action: string, params: Record<string, unknown>): Record<string, unknown> {
  switch (action) {
    case "create_issue":
      return {
        title: requireString(params["title"], "title"),
        body: requireString(params["body"], "body"),
        labels: Array.isArray(params["labels"]) ? params["labels"] : [],
      };
    case "create_pr_comment":
      return {
        body: requireString(params["body"], "body"),
      };
    case "dispatch_workflow":
      return {
        ref: requireString(params["ref"], "ref"),
        inputs: sanitizeWorkflowInputs(params["inputs"]),
      };
    default:
      throw new Error(`github_adapter.unsupported_action:${action}`);
  }
}
