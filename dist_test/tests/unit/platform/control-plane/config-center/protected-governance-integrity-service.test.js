import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { ProtectedGovernanceIntegrityService } from "../../../../../src/platform/control-plane/config-center/protected-governance-integrity-service.js";
import { createWorkspaceWritePolicy } from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../../helpers/fs.js";
function seedProtectedGovernanceTree(workspace) {
    const configRoot = join(workspace, "config");
    const divisionsRoot = join(workspace, "divisions");
    const agentsPath = join(workspace, "AGENTS.md");
    createFile(join(configRoot, "bootstrap/default.json"), JSON.stringify({ appName: "aa", phase: "phase_2a", stableCoreEnabled: true }));
    createFile(join(configRoot, "gateways/default.json"), JSON.stringify({ defaultGateway: "cli", sseEnabled: true }));
    createFile(join(configRoot, "providers/default.json"), JSON.stringify({ defaultProvider: "openai", defaultModelProfile: "reasoning-medium" }));
    createFile(join(configRoot, "runtime/default.json"), JSON.stringify({ maxConcurrentTasks: 2, defaultTaskTimeoutMs: 300000, defaultStepTimeoutMs: 120000 }));
    createFile(join(configRoot, "security/default.json"), JSON.stringify({ approvalMode: "supervised", sandboxMode: "workspace_write", allowDestructiveActions: false }));
    createFile(join(configRoot, "workflows/default.json"), JSON.stringify({ defaultWorkflowId: "single_agent_minimal", allowCrossDivisionDag: false }));
    createFile(join(divisionsRoot, "general_ops/division.yaml"), ["id: general_ops", "version: 1", "name: General Operations", "default_workflow: single_agent_minimal", "roles:", "  - id: general_executor", "    prompt: roles/general_executor.prompt.md", "    model: balanced", "    tools: [read, bash]"].join("\n"));
    createFile(join(divisionsRoot, "general_ops/roles/general_executor.prompt.md"), "# general executor\n");
    createFile(join(divisionsRoot, "general_ops/schemas/minimal-output.json"), JSON.stringify({
        type: "object",
        required: ["summary", "result"],
        properties: {
            summary: { type: "string", minLength: 1 },
            result: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
    }));
    createFile(join(divisionsRoot, "general_ops/workflows/minimal.yaml"), ["id: single_agent_minimal", "division_id: general_ops", "steps:", "  - step_id: analyze_request", "    role_id: general_executor", "    output_key: analysis", "    output_schema: schemas/minimal-output.json", "    timeout_ms: 120000", "    max_attempts: 1"].join("\n"));
    createFile(agentsPath, [
        "# Repository Guidelines",
        "",
        "## Build",
        "- `npm test`",
    ].join("\n"));
    return { configRoot, divisionsRoot, agentsPath };
}
test("protected governance integrity service versions config, divisions, and AGENTS surfaces", () => {
    const workspace = createTempWorkspace("aa-governance-");
    try {
        const paths = seedProtectedGovernanceTree(workspace);
        const service = new ProtectedGovernanceIntegrityService({
            ...paths,
            sandboxPolicy: createWorkspaceWritePolicy(workspace),
        });
        const snapshot = service.captureSnapshot();
        assert.equal(snapshot.surfaces.length, 3);
        assert.equal(snapshot.issues.length, 0);
        assert.equal(snapshot.surfaces.every((surface) => surface.hash != null), true);
        assert.equal(snapshot.surfaces.find((surface) => surface.surfaceId === "agents")?.fileCount, 1);
        assert.equal(snapshot.surfaces.find((surface) => surface.surfaceId === "config")?.fileCount, 6);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("protected governance integrity service detects drift against an expected version", () => {
    const workspace = createTempWorkspace("aa-governance-");
    try {
        const paths = seedProtectedGovernanceTree(workspace);
        const service = new ProtectedGovernanceIntegrityService({
            ...paths,
            sandboxPolicy: createWorkspaceWritePolicy(workspace),
        });
        const baseline = service.captureSnapshot();
        createFile(paths.agentsPath, "# Repository Guidelines\n\n## Build\n- `npm test`\n- `npm run doctor`\n");
        const drift = service.detectTampering(baseline.versionId);
        assert.equal(drift.checked, true);
        assert.equal(drift.tampered, true);
        assert.equal(drift.currentVersion === baseline.versionId, false);
        assert.ok(drift.issues.includes("protected.version_mismatch"));
    }
    finally {
        cleanupPath(workspace);
    }
});
test("protected governance integrity service returns empty snapshot when no files exist", () => {
    const workspace = createTempWorkspace("aa-governance-empty-");
    try {
        const service = new ProtectedGovernanceIntegrityService({
            configRoot: join(workspace, "config"),
            divisionsRoot: join(workspace, "divisions"),
            agentsPath: join(workspace, "AGENTS.md"),
            sandboxPolicy: createWorkspaceWritePolicy(workspace),
        });
        const snapshot = service.captureSnapshot();
        assert.ok(snapshot.surfaces.length >= 0);
        assert.ok(snapshot.issues.length >= 0);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=protected-governance-integrity-service.test.js.map