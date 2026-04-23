import assert from "node:assert/strict";
import test from "node:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { ProtectedGovernanceIntegrityService } from "../../../../src/platform/control-plane/config-center/protected-governance-integrity-service.js";
import { createWorkspaceWritePolicy } from "../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { cleanupPath, createFile, createSymlink, createTempWorkspace } from "../../../helpers/fs.js";
function seedProtectedGovernanceTree(workspace) {
    const configRoot = join(workspace, "config");
    const divisionsRoot = join(workspace, "divisions");
    const agentsPath = join(workspace, "AGENTS.md");
    createFile(join(configRoot, "bootstrap/default.json"), JSON.stringify({ appName: "aa" }));
    createFile(join(configRoot, "gateways/default.json"), JSON.stringify({ defaultGateway: "cli" }));
    createFile(join(configRoot, "providers/default.json"), JSON.stringify({ defaultProvider: "openai" }));
    createFile(join(configRoot, "runtime/default.json"), JSON.stringify({ maxConcurrentTasks: 2, defaultTaskTimeoutMs: 300000, defaultStepTimeoutMs: 120000 }));
    createFile(join(configRoot, "security/default.json"), JSON.stringify({ approvalMode: "supervised", sandboxMode: "workspace_write", allowDestructiveActions: false }));
    createFile(join(configRoot, "workflows/default.json"), JSON.stringify({ defaultWorkflowId: "single_agent_minimal" }));
    createFile(join(divisionsRoot, "general_ops/division.yaml"), "id: general_ops\nversion: 1\ndefault_workflow: single_agent_minimal\nroles:\n  - id: general_executor\n    prompt: roles/general_executor.prompt.md\n    model: balanced\n    tools: [read]\n");
    createFile(join(divisionsRoot, "general_ops/roles/general_executor.prompt.md"), "# prompt\n");
    createFile(join(divisionsRoot, "general_ops/schemas/minimal-output.json"), JSON.stringify({ type: "object", required: ["summary", "result"], properties: { summary: { type: "string", minLength: 1 }, result: { type: "string", minLength: 1 } }, additionalProperties: false }));
    createFile(join(divisionsRoot, "general_ops/workflows/minimal.yaml"), "id: single_agent_minimal\ndivision_id: general_ops\nsteps:\n  - step_id: analyze_request\n    role_id: general_executor\n    output_key: analysis\n    output_schema: schemas/minimal-output.json\n    timeout_ms: 120000\n    max_attempts: 1\n");
    createFile(agentsPath, "# Repository Guidelines\n");
    return { configRoot, divisionsRoot, agentsPath };
}
test("protected governance integrity service blocks AGENTS paths outside the workspace sandbox", () => {
    const workspace = createTempWorkspace("aa-governance-sec-");
    const outside = createTempWorkspace("aa-governance-outside-");
    try {
        const paths = seedProtectedGovernanceTree(workspace);
        createFile(join(outside, "AGENTS.md"), "# outside\n");
        const service = new ProtectedGovernanceIntegrityService({
            configRoot: paths.configRoot,
            divisionsRoot: paths.divisionsRoot,
            agentsPath: join(outside, "AGENTS.md"),
            sandboxPolicy: createWorkspaceWritePolicy(workspace),
        });
        assert.throws(() => service.captureSnapshot(), /sandbox\.path_outside_allowed_roots/);
    }
    finally {
        cleanupPath(workspace);
        cleanupPath(outside);
    }
});
test("protected governance integrity service blocks symlink escapes for AGENTS", () => {
    const workspace = createTempWorkspace("aa-governance-sec-");
    const outside = createTempWorkspace("aa-governance-target-");
    try {
        const paths = seedProtectedGovernanceTree(workspace);
        createFile(join(outside, "AGENTS.md"), "# outside\n");
        rmSync(paths.agentsPath);
        createSymlink(join(outside, "AGENTS.md"), paths.agentsPath);
        const service = new ProtectedGovernanceIntegrityService({
            ...paths,
            sandboxPolicy: createWorkspaceWritePolicy(workspace),
        });
        assert.throws(() => service.captureSnapshot(), /sandbox\.symlink_denied/);
    }
    finally {
        cleanupPath(workspace);
        cleanupPath(outside);
    }
});
//# sourceMappingURL=protected-governance-integrity-service.test.js.map