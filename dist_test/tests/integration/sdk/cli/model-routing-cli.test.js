import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import { LlmEvalService } from "../../../../src/platform/prompt-engine/eval/llm-eval-service.js";
import { PromptModelPolicyGovernanceService } from "../../../../src/platform/prompt-engine/eval/prompt-model-policy-governance-service.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../helpers/fs.js";
function runCli(env) {
    const stdout = execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "cli", "model-routing.js")], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            ...env,
        },
        encoding: "utf8",
    });
    return JSON.parse(stdout);
}
test("model routing CLI returns auditable conservative route decisions", () => {
    const workspace = createTempWorkspace("aa-model-route-cli-");
    const configRoot = join(workspace, "config");
    try {
        createFile(join(configRoot, "providers", "models.json"), JSON.stringify({
            version: "test-model-routing",
            providers: {
                minimax: { status: "active", authMethods: ["api_key"] },
                openai: { status: "active", authMethods: ["api_key"] },
            },
            profiles: {
                fast: {
                    provider: "minimax",
                    modelId: "MiniMax-Text-01",
                    tier: "fast",
                    capabilities: ["classification", "tool_use"],
                    contextWindowTokens: 512000,
                    maxOutputTokens: 32000,
                    pricing: { inputPer1kUsd: 0.0005, outputPer1kUsd: 0.001 },
                    metadataSource: "local_override",
                },
                "reasoning-medium": {
                    provider: "openai",
                    modelId: "gpt-5.2",
                    tier: "reasoning",
                    capabilities: ["reasoning", "tool_use", "json_mode"],
                    contextWindowTokens: 400000,
                    maxOutputTokens: 128000,
                    pricing: { inputPer1kUsd: 0.012, outputPer1kUsd: 0.036 },
                    metadataSource: "local_override",
                },
            },
        }, null, 2));
        const lowRisk = runCli({
            AA_CONFIG_ROOT: configRoot,
            AA_MODEL_ROUTE_CLASS: "classification",
            AA_MODEL_ROUTE_RISK_LEVEL: "low",
        });
        assert.equal(lowRisk.profileName, "fast");
        assert.equal(lowRisk.trace.routeReason, "classification_cheap_default");
        const highRisk = runCli({
            AA_CONFIG_ROOT: configRoot,
            AA_MODEL_ROUTE_RISK_LEVEL: "high",
        });
        assert.equal(highRisk.profileName, "reasoning-medium");
        assert.equal(highRisk.trace.routeReason, "risk_driven_reasoning");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("model routing CLI emits and reuses turn-scoped fallback leases", () => {
    const workspace = createTempWorkspace("aa-model-route-cli-fallback-");
    const configRoot = join(workspace, "config");
    try {
        createFile(join(configRoot, "providers", "models.json"), JSON.stringify({
            version: "test-model-routing-fallback",
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
                "reasoning-medium": {
                    provider: "openai",
                    modelId: "gpt-5.2",
                    tier: "reasoning",
                    capabilities: ["reasoning", "tool_use", "json_mode"],
                    contextWindowTokens: 400000,
                    maxOutputTokens: 128000,
                    pricing: { inputPer1kUsd: 0.012, outputPer1kUsd: 0.036 },
                    metadataSource: "local_override",
                },
            },
        }, null, 2));
        const firstTurn = runCli({
            AA_CONFIG_ROOT: configRoot,
            AA_MODEL_ROUTE_PREFERRED_PROFILE: "balanced",
            AA_MODEL_ROUTE_TURN_ID: "turn-1",
            AA_MODEL_HEALTH_JSON: JSON.stringify({
                anthropic: "failed",
                openai: "healthy",
            }),
        });
        assert.equal(firstTurn.profileName, "reasoning-medium");
        assert.equal(firstTurn.trace.routeReason, "provider_health_fallback");
        assert.equal(firstTurn.trace.turnScopedFallbackIssued, true);
        assert.equal(firstTurn.fallbackLease?.turnId, "turn-1");
        const sameTurn = runCli({
            AA_CONFIG_ROOT: configRoot,
            AA_MODEL_ROUTE_PREFERRED_PROFILE: "balanced",
            AA_MODEL_ROUTE_TURN_ID: "turn-1",
            AA_MODEL_ROUTE_FALLBACK_LEASE_JSON: JSON.stringify(firstTurn.fallbackLease),
            AA_MODEL_HEALTH_JSON: JSON.stringify({
                anthropic: "healthy",
                openai: "healthy",
            }),
        });
        assert.equal(sameTurn.profileName, "reasoning-medium");
        assert.equal(sameTurn.trace.routeReason, "turn_scoped_fallback_lease");
        assert.equal(sameTurn.trace.turnScopedFallbackActive, true);
        const nextTurn = runCli({
            AA_CONFIG_ROOT: configRoot,
            AA_MODEL_ROUTE_PREFERRED_PROFILE: "balanced",
            AA_MODEL_ROUTE_TURN_ID: "turn-2",
            AA_MODEL_ROUTE_FALLBACK_LEASE_JSON: JSON.stringify(firstTurn.fallbackLease),
            AA_MODEL_HEALTH_JSON: JSON.stringify({
                anthropic: "healthy",
                openai: "healthy",
            }),
        });
        assert.equal(nextTurn.profileName, "balanced");
        assert.equal(nextTurn.trace.routeReason, "preferred_profile");
        assert.equal(nextTurn.trace.turnScopedFallbackActive, false);
        assert.equal(nextTurn.fallbackLease, null);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("model routing CLI loads governance snapshot from storage and applies rollback fallback", () => {
    const workspace = createTempWorkspace("aa-model-route-cli-governance-");
    const configRoot = join(workspace, "config");
    const dbPath = join(workspace, "governance.db");
    try {
        createFile(join(configRoot, "providers", "models.json"), JSON.stringify({
            version: "test-model-routing-governance",
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
                "reasoning-medium": {
                    provider: "openai",
                    modelId: "gpt-5.2",
                    tier: "reasoning",
                    capabilities: ["reasoning", "tool_use", "json_mode"],
                    contextWindowTokens: 400000,
                    maxOutputTokens: 128000,
                    pricing: { inputPer1kUsd: 0.012, outputPer1kUsd: 0.036 },
                    metadataSource: "local_override",
                },
            },
        }, null, 2));
        const db = new SqliteDatabase(dbPath);
        try {
            db.migrate();
            const evalService = new LlmEvalService(db);
            const governance = new PromptModelPolicyGovernanceService(db, evalService);
            const suite = evalService.defineSuite({
                name: "model-routing-cli-governance-suite",
                kind: "regression",
                cases: [{ id: "c1", input: "input", expectedOutput: "expected" }],
            });
            const release = governance.registerModelRelease({
                profileName: "balanced",
                version: "model.v7",
                owner: "ops.ai",
                frozenModelId: "claude-sonnet-4-20250514",
                evaluationSuiteId: suite.id,
                reviewRequired: false,
                fallbackProfiles: ["reasoning-medium"],
                rollbackProfileName: "reasoning-medium",
            });
            governance.evaluateReleaseGate({
                releaseId: release.id,
                modelId: "balanced",
                promptVersion: "model.v7",
                baselinePromptVersion: "model.v6",
                evaluator: () => ({
                    actualOutput: "wrong",
                    passed: false,
                    score: 0,
                }),
            });
        }
        finally {
            db.close();
        }
        const routed = runCli({
            AA_CONFIG_ROOT: configRoot,
            AA_DB_PATH: dbPath,
            AA_MODEL_ROUTE_PREFERRED_PROFILE: "balanced",
            AA_MODEL_ROUTE_LOAD_GOVERNANCE_SNAPSHOT: "true",
        });
        assert.equal(routed.profileName, "reasoning-medium");
        assert.equal(routed.trace.routeReason, "governance_fallback");
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=model-routing-cli.test.js.map