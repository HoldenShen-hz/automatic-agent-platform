import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { BillingService } from "../../../../src/scale-ecosystem/marketplace/billing-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedBillingDataset } from "../../../helpers/billing.js";
test("billing service exports account summaries with persisted artifact evidence", () => {
    const workspace = createTempWorkspace("aa-billing-export-");
    const dbPath = join(workspace, "billing-export.db");
    const artifactRoot = join(workspace, "artifacts");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        seedBillingDataset(db, store);
        const service = new BillingService(db, store, {
            artifactStoreOptions: {
                rootDir: artifactRoot,
            },
        });
        const exported = service.exportAccountSummary("acct-pro-1");
        assert.equal(exported.summary.account.accountId, "acct-pro-1");
        assert.equal(exported.summary.totals.usageEventCount, 3);
        assert.ok(exported.summary.totals.totalBilledUsd > 0);
        assert.match(exported.jsonArtifact.uri, /billing-summary-acct-pro-1/);
        assert.match(exported.markdownArtifact.uri, /billing-summary-acct-pro-1/);
        const snapshot = store.loadTaskSnapshot("billing_reporting");
        assert.ok(snapshot);
        assert.equal(snapshot?.artifacts.length, 2);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("billing service keeps quota windows isolated per month", () => {
    const workspace = createTempWorkspace("aa-billing-window-");
    const dbPath = join(workspace, "billing-window.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        seedBillingDataset(db, store);
        const service = new BillingService(db, store);
        const summary = service.buildAccountSummary("acct-pro-1");
        const taskQuota = summary.quotas.find((item) => item.metricType === "task_execution");
        assert.ok(taskQuota);
        assert.equal(taskQuota?.usedQuantity, 3);
        const decision = service.evaluateEntitlement({
            accountId: "acct-pro-1",
            featureKey: "phase3.billing_export",
            metricType: "task_execution",
            requestedQuantity: 997,
            evaluatedAt: "2026-04-08T12:00:00.000Z",
        });
        assert.equal(decision.decision.decisionType, "allow");
        assert.equal(decision.remainingQuantity, 0);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=billing-service.test.js.map