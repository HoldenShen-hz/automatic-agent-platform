import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import { createEnterpriseCapabilityMatrixService } from "../../../../src/scale-ecosystem/marketplace/enterprise-capability-matrix-service.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
function runCli(env) {
    return execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "cli", "enterprise-capability.js")], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            ...env,
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    });
}
test("enterprise capability CLI fail-closes on malformed secondary gates json", () => {
    const workspace = createTempWorkspace("aa-enterprise-security-");
    const dbPath = join(workspace, "enterprise-security.db");
    try {
        assert.throws(() => runCli({
            AA_DB_PATH: dbPath,
            AA_ENTERPRISE_ACTION: "register_readiness",
            AA_ENVIRONMENT: "prod",
            AA_COMPONENT_TYPE: "provider",
            AA_COMPONENT_ID: "private_model_provider",
            AA_CREDENTIAL_READY: "true",
            AA_SECONDARY_GATES_JSON: '{"export_ready":"yes"}',
            AA_OWNER: "ops.team",
        }), /invalid_gate_value:AA_SECONDARY_GATES_JSON/);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("enterprise capability CLI fail-closes on invalid component identifiers", () => {
    const workspace = createTempWorkspace("aa-enterprise-security-");
    const dbPath = join(workspace, "enterprise-security.db");
    try {
        assert.throws(() => runCli({
            AA_DB_PATH: dbPath,
            AA_ENTERPRISE_ACTION: "register_readiness",
            AA_ENVIRONMENT: "prod",
            AA_COMPONENT_TYPE: "gateway",
            AA_COMPONENT_ID: "../ops_gateway",
            AA_CREDENTIAL_READY: "true",
            AA_OWNER: "ops.team",
        }), /enterprise\.invalid_component_id/);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("enterprise capability service factory routes postgres dual-run sync access through shadow sqlite", () => {
    const workspace = createTempWorkspace("aa-enterprise-security-");
    const dbPath = join(workspace, "enterprise-security-factory.db");
    const shadowPath = join(workspace, "shadow.db");
    const previousEnv = {
        AA_STORAGE_DRIVER: process.env.AA_STORAGE_DRIVER,
        AA_STORAGE_POSTGRES_DSN: process.env.AA_STORAGE_POSTGRES_DSN,
        AA_STORAGE_POSTGRES_DUAL_RUN: process.env.AA_STORAGE_POSTGRES_DUAL_RUN,
        AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: process.env.AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH,
    };
    try {
        process.env.AA_STORAGE_DRIVER = "postgres";
        process.env.AA_STORAGE_POSTGRES_DSN = "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require";
        process.env.AA_STORAGE_POSTGRES_DUAL_RUN = "true";
        process.env.AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH = shadowPath;
        const service = createEnterpriseCapabilityMatrixService(dbPath);
        service.registerEnvironmentReadiness({
            environment: "staging",
            componentType: "gateway",
            componentId: "ops_gateway",
            credentialReady: true,
            owner: "ops.team",
        });
        const result = service.buildMatrix({
            environment: "staging",
            deploymentMode: "cloud_shared",
        });
        assert.equal(result.report.environment, "staging");
        assert.equal(result.report.entries.length > 0, true);
    }
    finally {
        for (const [key, value] of Object.entries(previousEnv)) {
            if (value == null) {
                delete process.env[key];
            }
            else {
                process.env[key] = value;
            }
        }
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=enterprise-capability-boundary.test.js.map