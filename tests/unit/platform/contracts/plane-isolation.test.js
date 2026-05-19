/**
 * [SYS-ARCH-1.1] Plane Isolation Tests
 *
 * Verifies that cross-plane imports violate architecture.
 * These tests ensure the five-plane runtime structure is maintained.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { globSync } from "glob";
import { readFileSync } from "fs";
const STATE_EVIDENCE_EXECUTION_EXCEPTIONS = new Set([
    "src/platform/state-evidence/artifacts/artifact-store.ts",
    "src/platform/state-evidence/knowledge/archive/knowledge-snapshot-store.ts",
    "src/platform/state-evidence/truth/runtime-truth-repository.ts",
]);
const STATE_EVIDENCE_EXECUTION_EXCEPTION_PREFIXES = [
    "src/platform/state-evidence/artifacts/",
    "src/platform/state-evidence/knowledge/",
];
const STATE_EVIDENCE_CONTROL_PLANE_EXCEPTIONS = new Set([
    "src/platform/state-evidence/truth/schema-inventory-service.ts",
    "src/platform/state-evidence/truth/storage-backend-config.ts",
    "src/platform/state-evidence/truth/storage-backend-factory.ts",
    "src/platform/state-evidence/truth/storage-quota-service.ts",
    "src/platform/state-evidence/truth/sqlite/sqlite-migration-runtime-part3.ts",
]);
const STATE_EVIDENCE_CONTROL_PLANE_EXCEPTION_PREFIXES = [
    "src/platform/state-evidence/artifacts/",
    "src/platform/state-evidence/truth/storage-",
    "src/platform/state-evidence/truth/sqlite/",
];
const CONTROL_PLANE_STATE_EVIDENCE_EXCEPTIONS = new Set([
    "src/platform/control-plane/rollout-controller/traffic-routing-service.ts",
    "src/platform/control-plane/incident-control/tenant-execution-isolation-service.ts",
    "src/platform/control-plane/incident-control/runtime-version-snapshot.ts",
    "src/platform/control-plane/incident-control/release-pipeline-support.ts",
]);
const CONTROL_PLANE_STATE_EVIDENCE_EXCEPTION_PREFIXES = [
    "src/platform/control-plane/approval-center/",
    "src/platform/control-plane/audit-export/",
    "src/platform/control-plane/compliance/",
    "src/platform/control-plane/config-center/",
    "src/platform/control-plane/cost-alert/",
    "src/platform/control-plane/iam/",
    "src/platform/control-plane/incident-control/",
    "src/platform/control-plane/rollout-controller/",
];
const CONTROL_PLANE_EXECUTION_EXCEPTIONS = new Set([
    "src/platform/control-plane/incident-control/doctor-service.ts",
    "src/platform/control-plane/config-center/runtime-ops-env.ts",
    "src/platform/control-plane/config-center/resource-ceiling.ts",
    "src/platform/control-plane/iam/policy-engine.ts",
]);
const CONTROL_PLANE_EXECUTION_EXCEPTION_PREFIXES = [
    "src/platform/control-plane/incident-control/",
    "src/platform/control-plane/config-center/",
    "src/platform/control-plane/approval-center/",
    "src/platform/control-plane/iam/",
];
test("[SYS-ARCH-1.1] no cross-plane imports from state-evidence to execution", () => {
    const stateEvidenceFiles = globSync("src/platform/state-evidence/**/*.ts");
    for (const file of stateEvidenceFiles) {
        if (STATE_EVIDENCE_EXECUTION_EXCEPTIONS.has(file)
            || STATE_EVIDENCE_EXECUTION_EXCEPTION_PREFIXES.some((prefix) => file.startsWith(prefix))) {
            continue;
        }
        const content = readFileSync(file, "utf8");
        // Skip declaration files and index files
        if (file.endsWith(".d.ts") || file.endsWith("/index.ts")) {
            continue;
        }
        assert.ok(!content.match(/from\s+"[^"]*\/execution\//), `${file} must not import from execution plane`);
    }
});
test("[SYS-ARCH-1.1] no cross-plane imports from state-evidence to control-plane", () => {
    const stateEvidenceFiles = globSync("src/platform/state-evidence/**/*.ts");
    for (const file of stateEvidenceFiles) {
        if (STATE_EVIDENCE_CONTROL_PLANE_EXCEPTIONS.has(file)
            || STATE_EVIDENCE_CONTROL_PLANE_EXCEPTION_PREFIXES.some((prefix) => file.startsWith(prefix))) {
            continue;
        }
        const content = readFileSync(file, "utf8");
        // Skip declaration files and index files
        if (file.endsWith(".d.ts") || file.endsWith("/index.ts")) {
            continue;
        }
        assert.ok(!content.match(/from\s+"[^"]*\/control-plane\//), `${file} must not import from control-plane`);
    }
});
test("[SYS-ARCH-1.1] no cross-plane imports from control-plane to state-evidence", () => {
    const controlPlaneFiles = globSync("src/platform/control-plane/**/*.ts");
    for (const file of controlPlaneFiles) {
        if (CONTROL_PLANE_STATE_EVIDENCE_EXCEPTIONS.has(file)
            || CONTROL_PLANE_STATE_EVIDENCE_EXCEPTION_PREFIXES.some((prefix) => file.startsWith(prefix))) {
            continue;
        }
        const content = readFileSync(file, "utf8");
        // Skip declaration files and index files
        if (file.endsWith(".d.ts") || file.endsWith("/index.ts")) {
            continue;
        }
        assert.ok(!content.match(/from\s+"[^"]*\/state-evidence\//), `${file} must not import from state-evidence plane`);
    }
});
test("[SYS-ARCH-1.1] no cross-plane imports from control-plane to execution", () => {
    const controlPlaneFiles = globSync("src/platform/control-plane/**/*.ts");
    for (const file of controlPlaneFiles) {
        if (CONTROL_PLANE_EXECUTION_EXCEPTIONS.has(file)
            || CONTROL_PLANE_EXECUTION_EXCEPTION_PREFIXES.some((prefix) => file.startsWith(prefix))) {
            continue;
        }
        const content = readFileSync(file, "utf8");
        // Skip declaration files and index files
        if (file.endsWith(".d.ts") || file.endsWith("/index.ts")) {
            continue;
        }
        assert.ok(!content.match(/from\s+"[^"]*\/execution\//), `${file} must not import from execution plane`);
    }
});
test("[SYS-ARCH-1.1] no cross-plane imports from interface to execution skipping shared", () => {
    const interfaceFiles = globSync("src/platform/interface/**/*.ts");
    for (const file of interfaceFiles) {
        const content = readFileSync(file, "utf8");
        // Skip declaration files and index files
        if (file.endsWith(".d.ts") || file.endsWith("/index.ts")) {
            continue;
        }
        // Interface may only import from shared and contracts
        const lines = content.split("\n");
        for (const line of lines) {
            const match = line.match(/from\s+"([^"]+)";/);
            if (match && match[1] !== undefined) {
                const importPath = match[1];
                // Allowed: relative imports, shared, contracts
                const isAllowed = importPath.startsWith(".") ||
                    importPath.includes("/shared/") ||
                    importPath.includes("/contracts/") ||
                    importPath.includes("@") ||
                    importPath.startsWith("#");
                const isCrossPlaneToExecution = !importPath.startsWith(".") &&
                    !importPath.includes("/shared/") &&
                    !importPath.includes("/contracts/") &&
                    !importPath.includes("@") &&
                    !importPath.startsWith("#") &&
                    importPath.includes("/execution/");
                assert.ok(isAllowed || !isCrossPlaneToExecution, `${file} must not import from execution plane directly (use shared adapter)`);
            }
        }
    }
});
//# sourceMappingURL=plane-isolation.test.js.map