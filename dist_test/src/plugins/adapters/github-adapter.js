import { PolicyDeniedError } from "../../platform/contracts/errors.js";
import { NetworkEgressPolicyService } from "../../platform/control-plane/iam/network-egress-policy.js";
function requireString(value, field) {
    if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(`github_adapter.missing_${field}`);
    }
    return value.trim();
}
export function createGithubAdapterPlugin(options = {}) {
    const apiBaseUrl = (options.apiBaseUrl ?? "https://api.github.com").replace(/\/+$/, "");
    const policy = options.policy ?? new NetworkEgressPolicyService({
        mode: "enforce",
        allowedDomains: ["api.github.com", "github.com"],
    });
    let credentialFingerprint = null;
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
            const repository = requireString(params["repository"], "repository");
            const endpoint = buildEndpoint(apiBaseUrl, action, repository, params);
            const decision = policy.evaluate(endpoint);
            if (!decision.allowed) {
                throw new PolicyDeniedError(decision.reasonCode ?? "github_adapter.egress_blocked", `Network egress denied for ${endpoint}`, {
                    category: "policy",
                    source: "internal",
                    details: {
                        action,
                        endpoint,
                        destination: decision.destination,
                        reasonCode: decision.reasonCode,
                    },
                });
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
}
function buildEndpoint(apiBaseUrl, action, repository, params) {
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
function buildPayload(action, params) {
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
//# sourceMappingURL=github-adapter.js.map