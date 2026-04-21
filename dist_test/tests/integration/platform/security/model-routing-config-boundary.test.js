import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import { cleanupPath, createFile, createSymlink, createTempWorkspace } from "../../../helpers/fs.js";
function runCliExpectFailure(env) {
    try {
        execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "cli", "model-routing.js")], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                ...env,
            },
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
        throw new Error("expected_cli_failure");
    }
    catch (error) {
        if (!(error instanceof Error) || !("stderr" in error)) {
            throw error;
        }
        return String(error.stderr ?? error.message);
    }
}
test("model routing CLI fail-closes when models registry escapes sandbox via symlink", () => {
    const workspace = createTempWorkspace("aa-model-route-sandbox-");
    const configRoot = join(workspace, "config");
    const outside = createTempWorkspace("aa-model-route-outside-");
    try {
        createFile(join(outside, "models.json"), JSON.stringify({
            version: "outside-registry",
            providers: { openai: { status: "active", authMethods: ["api_key"] } },
            profiles: {
                fast: {
                    provider: "openai",
                    modelId: "gpt-fast",
                    tier: "fast",
                    capabilities: ["classification"],
                    contextWindowTokens: 1000,
                    maxOutputTokens: 1000,
                    pricing: { inputPer1kUsd: 0.001, outputPer1kUsd: 0.002 },
                    metadataSource: "local_override",
                },
            },
        }, null, 2));
        createSymlink(join(outside, "models.json"), join(configRoot, "providers", "models.json"));
        const stderr = runCliExpectFailure({
            AA_CONFIG_ROOT: configRoot,
        });
        assert.match(stderr, /sandbox\.symlink_denied|config\.model_registry_denied/);
    }
    finally {
        cleanupPath(workspace);
        cleanupPath(outside);
    }
});
test("model routing CLI fail-closes on malformed turn fallback lease json", () => {
    const workspace = createTempWorkspace("aa-model-route-lease-");
    const configRoot = join(workspace, "config");
    try {
        createFile(join(configRoot, "providers", "models.json"), JSON.stringify({
            version: "test-model-routing",
            providers: {
                anthropic: { status: "active", authMethods: ["api_key"] },
                openai: { status: "active", authMethods: ["api_key"] },
            },
            profiles: {
                balanced: {
                    provider: "anthropic",
                    modelId: "claude-sonnet",
                    tier: "balanced",
                    capabilities: ["reasoning", "writing", "tool_use"],
                    contextWindowTokens: 200000,
                    maxOutputTokens: 64000,
                    pricing: { inputPer1kUsd: 0.003, outputPer1kUsd: 0.015 },
                    metadataSource: "local_override",
                },
            },
        }, null, 2));
        const stderr = runCliExpectFailure({
            AA_CONFIG_ROOT: configRoot,
            AA_MODEL_ROUTE_TURN_ID: "turn-1",
            AA_MODEL_ROUTE_FALLBACK_LEASE_JSON: "{\"turnId\":",
        });
        assert.match(stderr, /invalid_json:AA_MODEL_ROUTE_FALLBACK_LEASE_JSON/);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("model routing CLI fail-closes on malformed governance snapshot json", () => {
    const workspace = createTempWorkspace("aa-model-route-governance-json-");
    const configRoot = join(workspace, "config");
    try {
        createFile(join(configRoot, "providers", "models.json"), JSON.stringify({
            version: "test-model-routing",
            providers: {
                anthropic: { status: "active", authMethods: ["api_key"] },
            },
            profiles: {
                balanced: {
                    provider: "anthropic",
                    modelId: "claude-sonnet",
                    tier: "balanced",
                    capabilities: ["reasoning", "writing", "tool_use"],
                    contextWindowTokens: 200000,
                    maxOutputTokens: 64000,
                    pricing: { inputPer1kUsd: 0.003, outputPer1kUsd: 0.015 },
                    metadataSource: "local_override",
                },
            },
        }, null, 2));
        const stderr = runCliExpectFailure({
            AA_CONFIG_ROOT: configRoot,
            AA_MODEL_ROUTE_GOVERNANCE_SNAPSHOT_JSON: "{\"profileStatuses\":",
        });
        assert.match(stderr, /invalid_json:AA_MODEL_ROUTE_GOVERNANCE_SNAPSHOT_JSON/);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=model-routing-config-boundary.test.js.map