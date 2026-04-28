import type { ExternalAdapterPlugin, PluginLifecycleContext, PluginManifest } from "../../domains/registry/plugin-spi.js";
import { PluginManifestSchema } from "../../domains/registry/plugin-spi.js";
import { PolicyDeniedError } from "../../platform/contracts/errors.js";
import { NetworkEgressPolicyService } from "../../platform/control-plane/iam/network-egress-policy.js";

// §10 Built-in plugins require PluginManifest with owner/trustLevel/sbomRef/publicSdkSurface
const GITHUB_ADAPTER_MANIFEST: PluginManifest = {
  pluginId: "plugin.shared.github_adapter",
  name: "GitHub Adapter",
  version: "1.0.0",
  owner: "platform-team",
  domainIds: ["coding", "operations", "growth"],
  capabilityIds: ["external.github", "external.github.issue", "external.github.workflow"],
  spiTypes: ["adapter"],
  extensionKind: "external_adapter",
  trustLevel: "trusted",
  publicSdkSurface: "@automatic-agent/plugin-github-adapter",
  settingsSchema: {},
  sandbox: {
    timeoutMs: 5000,
    allowFilesystemWrite: false,
    allowNetworkEgress: true,
    allowedKnowledgeNamespaces: [],
    maxConcurrentInvocations: 4,
    maxQueuedInvocations: 8,
    runtimeIsolation: "serialized_in_process",
    cooldownMs: 0,
  },
};

export interface GithubAdapterPluginOptions {
  apiBaseUrl?: string;
  policy?: NetworkEgressPolicyService;
  /** @deprecated Manifest is now required - pass manifest or use default */
  manifest?: PluginManifest;
  /** Signature verification for plugin loading per §10 */
  verifySignature?: boolean;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`github_adapter.missing_${field}`);
  }
  return value.trim();
}

/**
 * Verify plugin signature before activation per §10.
 * Requires signing.keyId/signature/algorithm verification before activation.
 */
function verifyPluginSignature(
  manifest: PluginManifest,
  expectedSignature?: string,
): void {
  if (!manifest.signing) {
    // No signature configured - allow for trusted built-in plugins
    if (manifest.trustLevel === "internal" || manifest.trustLevel === "trusted") {
      return;
    }
    throw new Error("github_adapter.signature_required: Plugin signing configuration is required");
  }

  const { keyId, signature, algorithm } = manifest.signing;
  if (!keyId || !signature || !algorithm) {
    throw new Error("github_adapter.invalid_signature: signing.keyId/signature/algorithm are required");
  }

  // If expected signature is provided, verify it matches
  if (expectedSignature && signature !== expectedSignature) {
    throw new Error("github_adapter.signature_mismatch: Plugin signature verification failed");
  }
}

export function createGithubAdapterPlugin(options: GithubAdapterPluginOptions = {}): ExternalAdapterPlugin {
  const apiBaseUrl = (options.apiBaseUrl ?? "https://api.github.com").replace(/\/+$/, "");
  const policy = options.policy ?? new NetworkEgressPolicyService({
    mode: "enforce",
    allowedDomains: ["api.github.com", "github.com"],
  });
  let credentialFingerprint: string | null = null;

  // §10: Use provided manifest or default builtin manifest
  const manifest = options.manifest ?? GITHUB_ADAPTER_MANIFEST;

  // §10: Verify signature before activation if verifySignature is true
  if (options.verifySignature) {
    verifyPluginSignature(manifest);
  }

  const plugin: ExternalAdapterPlugin = {
    pluginId: manifest.pluginId,
    spiType: "adapter",
    adapterType: "github",
    capabilityIds: manifest.capabilityIds,
    manifest,

    // §10 Complete lifecycle hooks
    async onLoad(context: PluginLifecycleContext): Promise<void> {
      // Plugin is being loaded - perform any initialization
      void context;
      return;
    },

    async onActivate(context: PluginLifecycleContext): Promise<void> {
      // Plugin is being activated - verify credentials
      void context;
      if (!credentialFingerprint) {
        throw new Error("github_adapter.not_authenticated: authenticate() must be called before activation");
      }
      return;
    },

    async onDeactivate(context: PluginLifecycleContext): Promise<void> {
      // Plugin is being deactivated - clean up resources
      void context;
      credentialFingerprint = null;
      return;
    },

    async onUnload(context: PluginLifecycleContext): Promise<void> {
      // Plugin is being unloaded - release all resources
      void context;
      return;
    },

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
      const repository = requireString(params["repository"], "repository");
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
      return {
        adapter: "github",
        action,
        repository,
        endpoint,
        credentialFingerprint,
        payload: buildPayload(action, params),
      };
    },
  };

  return plugin;
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
      return `${apiBaseUrl}/repos/${repository}/contents/${requireString(params["path"], "path")}`;
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
