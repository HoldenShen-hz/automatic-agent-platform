import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { HaProgramService } from "../../../../src/scale-ecosystem/marketplace/ha-program-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
test("HaProgramService reports missing HA readiness as blockers by default", () => {
    const workspace = createTempWorkspace("aa-ha-program-");
    const dbPath = join(workspace, "ha-program.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    try {
        const store = new AuthoritativeTaskStore(db);
        const service = new HaProgramService(store);
        const report = service.buildReport({ environment: "prod" });
        assert.equal(report.overallStatus, "fail");
        assert.equal(report.components.length, 4);
        assert.ok(report.components.some((component) => component.blockers.length > 0));
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
test("HaProgramService checks environment-specific HA requirements", () => {
    const workspace = createTempWorkspace("aa-ha-env-");
    const dbPath = join(workspace, "ha-env.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    try {
        const store = new AuthoritativeTaskStore(db);
        const service = new HaProgramService(store);
        const prodReport = service.buildReport({ environment: "prod" });
        const stagingReport = service.buildReport({ environment: "staging" });
        // Both environments should have the same component count
        assert.equal(prodReport.components.length, stagingReport.components.length);
        // But they may differ in blocker counts
        assert.ok(prodReport.environment === "prod" || stagingReport.environment === "staging");
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
test("HaProgramService returns report with required fields", () => {
    const workspace = createTempWorkspace("aa-ha-report-fields-");
    const dbPath = join(workspace, "ha-report-fields.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    try {
        const store = new AuthoritativeTaskStore(db);
        const service = new HaProgramService(store);
        const report = service.buildReport({ environment: "prod" });
        assert.ok(typeof report.overallStatus === "string");
        assert.ok(typeof report.components === "object");
        assert.ok(Array.isArray(report.components));
        assert.ok(report.components.length > 0);
        assert.ok(report.components.every((c) => typeof c.componentId === "string"));
        assert.ok(report.components.every((c) => Array.isArray(c.blockers)));
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
test("HaProgramService handles dev environment without HA requirements", () => {
    const workspace = createTempWorkspace("aa-ha-dev-");
    const dbPath = join(workspace, "ha-dev.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    try {
        const store = new AuthoritativeTaskStore(db);
        const service = new HaProgramService(store);
        const report = service.buildReport({ environment: "dev" });
        assert.ok(typeof report.overallStatus === "string");
        assert.equal(report.environment, "dev");
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=ha-program-service.test.js.map