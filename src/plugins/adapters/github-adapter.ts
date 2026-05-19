import type { ExternalAdapterPlugin } from "../../domains/registry/plugin-spi.js";
import { PolicyDeniedError } from "../../platform/contracts/errors.js";
import { NetworkEgressPolicyService } from "../../platform/five-plane-control-plane/iam/network-egress-policy.js";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// R8-25 FIX: Plugin signature verification for secure plugin loading

export interface GithubAdapterPluginOptions {
  apiBaseUrl?: string;
  policy?: NetworkEgressPolicyService;
  signatureKey?: string;
  defaultTimeoutMs?: number;
  defaultRateLimitPerMinute?: number;
}

/**
 * R8-25 FIX: Plugin signature verification result
 */
export interface PluginSignatureVerificationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly verifiedAt: string;
}

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

export function createGithubAdapterPlugin(options: GithubAdapterPluginOptions = {}): ExternalAdapterPlugin {
  const apiBaseUrl = (options.apiBaseUrl ?? "https://api.github.com").replace(/\/+$/, "");
  const policy = options.policy ?? new NetworkEgressPolicyService({
    mode: "enforce",
    allowedDomains: ["api.github.com", "github.com"],
  });
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 10_000;
  const defaultRateLimitPerMinute = options.defaultRateLimitPerMinute ?? 60;
  let credentialFingerprint: string | null = null;

  return {
    pluginId: "plugin.shared.github_adapter",
    spiType: "adapter",
    adapterType: "github",
    capabilityIds: ["external.github", "external.github.issue", "external.github.workflow"],
    async initialize() {
      return undefined;
    },
    async healthCheck() {
      return policy.evaluate(`${apiBaseUrl}/rate_limit`).allowed;
    },
    async shutdown() {
      credentialFingerprint = null;
    },
    async authenticate(credentials) {
      const token = requireString(credentials["token"] ?? credentials["managedSecretRef"], "token");
      credentialFingerprint = token.startsWith("secret://") ? token : `token:${token.slice(0, 4)}`;
    },
    async execute(action, params) {
      if (!credentialFingerprint) {
        throw new Error("github_adapter.not_authenticated");
      }
      const repository = requireRepository(params["repository"]);
      const endpoint = buildEndpoint(apiBaseUrl, action, repository, params);
      const decision = policy.evaluate(endpoint);
      if (!decision.allowed) {
        throw new PolicyDeniedError(
          decision.reasonCode ?? "github_adapter.egress_blocked",
          `Network egress denied for ${endpoint}`,
          {
            category: "policy",
            source: "internal",
            details: {
              action,
              endpoint,
              destination: decision.destination,
              reasonCode: decision.reasonCode,
            },
          },
        );
      }
      const idempotencyKey = action === "get_file" ? null : createHash("sha256")
        .update(`${action}:${repository}:${JSON.stringify(params)}`)
        .digest("hex");
      return {
        adapter: "github",
        action,
        repository,
        endpoint,
        credentialFingerprint,
        timeoutMs: defaultTimeoutMs,
        rateLimitPerMinute: defaultRateLimitPerMinute,
        retryPolicy: { maxRetries: 3, backoffMs: 250 },
        ...(idempotencyKey == null ? {} : { idempotencyKey }),
        payload: buildPayload(action, params),
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

function buildEndpoint(apiBaseUrl: string, action: string, repository: string, params: Record<string, unknown>): string {
  switch (action) {
    case "create_issue":
      return `${apiBaseUrl}/repos/${repository}/issues`;
    case "create_pr_comment":
      return `${apiBaseUrl}/repos/${repository}/issues/${requireString(params["issueNumber"], "issueNumber")}/comments`;
    case "dispatch_workflow":
      return `${apiBaseUrl}/repos/${repository}/actions/workflows/${requireString(params["workflowId"], "workflowId")}/dispatches`;
    case "get_file":
      return `${apiBaseUrl}/repos/${repository}/contents/${encodeRepositoryPath(requireString(params["path"], "path"))}`;
    default:
      return `${apiBaseUrl}/repos/${repository}`;
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
        issueNumber: requireString(params["issueNumber"], "issueNumber"),
        body: requireString(params["body"], "body"),
      };
    case "dispatch_workflow":
      return {
        workflowId: requireString(params["workflowId"], "workflowId"),
        ref: requireString(params["ref"], "ref"),
        inputs: typeof params["inputs"] === "object" && params["inputs"] != null ? params["inputs"] : {},
      };
    case "get_file":
      return {
        path: requireString(params["path"], "path"),
        ref: typeof params["ref"] === "string" ? params["ref"] : "main",
      };
    default:
      return { ...params };
  }
}
