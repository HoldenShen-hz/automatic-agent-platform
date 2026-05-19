import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { BillingService } from "../../src/scale-ecosystem/billing/billing-service.js";
import { PerceptionService } from "../../src/scale-ecosystem/intelligence/perception-service.js";
import { createE2EHarness } from "../helpers/e2e-harness.js";
test("E2E: perception ingests intel under billing entitlement, deduplicates signals, and exports a brief with proposals", () => {
    const harness = createE2EHarness("aa-e2e-perception-flow-");
    const artifactRoot = join(harness.workspace, "artifacts");
    try {
        const billing = new BillingService(harness.db, harness.store);
        const account = billing.createAccount({
            accountId: "acct-perception-e2e",
            ownerId: "owner-perception-e2e",
            workspaceId: "workspace-perception-e2e",
            planId: "enterprise",
            createdAt: "2026-04-24T11:00:00.000Z",
        });
        const perception = new PerceptionService(harness.db, harness.store, {
            artifactStoreOptions: {
                rootDir: artifactRoot,
            },
            billingService: billing,
        });
        const source = perception.registerSource({
            sourceId: "source-perception-e2e",
            tenantId: "tenant-perception-e2e",
            type: "rss",
            name: "Runtime Signals",
            priority: 9,
            schedule: { cadence: "hourly" },
            filters: { tags: ["runtime", "incident"] },
            accountId: account.accountId,
        });
        const ingested = perception.ingestIntel({
            sourceId: source.sourceId,
            tenantId: source.tenantId,
            accountId: account.accountId,
            items: [
                {
                    title: "Latency regression in rollout cohort",
                    summary: "Latency p95 crossed the incident threshold for the canary cohort.",
                    rawRef: "https://example.test/latency",
                    relevanceScore: 0.93,
                    importance: 0.96,
                    tags: ["incident", "latency"],
                    capturedAt: "2026-04-24T10:00:00.000Z",
                    ttlHours: 48,
                },
                {
                    title: "Latency regression duplicate",
                    summary: "Duplicate copy of the same latency signal should be ignored.",
                    rawRef: "https://example.test/latency",
                    relevanceScore: 0.9,
                    importance: 0.9,
                    tags: ["incident", "latency"],
                    capturedAt: "2026-04-24T10:01:00.000Z",
                    ttlHours: 48,
                },
                {
                    title: "Support queue growth",
                    summary: "Support queue increased after a pricing and packaging change.",
                    rawRef: "https://example.test/support-queue",
                    relevanceScore: 0.81,
                    importance: 0.78,
                    tags: ["support", "pricing"],
                    capturedAt: "2026-04-24T10:02:00.000Z",
                    ttlHours: 48,
                },
                {
                    title: "Expired low-signal mention",
                    summary: "Older low-signal chatter that should expire before the brief is built.",
                    rawRef: "https://example.test/expired",
                    relevanceScore: 0.3,
                    importance: 0.2,
                    tags: ["noise"],
                    capturedAt: "2026-04-24T06:00:00.000Z",
                    ttlHours: 1,
                },
            ],
        });
        const built = perception.buildBrief({
            tenantId: source.tenantId,
            sourceIds: [source.sourceId],
            generatedAt: "2026-04-24T12:00:00.000Z",
            accountId: account.accountId,
        });
        const firstProposals = perception.proposeActions({
            briefId: built.brief.briefId,
            tenantId: source.tenantId,
            accountId: account.accountId,
        });
        const secondProposals = perception.proposeActions({
            briefId: built.brief.briefId,
            tenantId: source.tenantId,
            accountId: account.accountId,
        });
        const exported = perception.exportBrief(built.brief.briefId, account.accountId, source.tenantId);
        const markdown = readFileSync(exported.markdownArtifact.uri, "utf8");
        assert.equal(ingested.insertedItems.length, 3);
        assert.equal(ingested.skippedDuplicateCount, 1);
        assert.equal(built.items.length, 2);
        assert.deepEqual(built.recommendedActions.map((action) => action.actionType), ["investigate", "notify"]);
        assert.equal(firstProposals.length, 2);
        assert.deepEqual(secondProposals.map((proposal) => proposal.proposalId).sort(), firstProposals.map((proposal) => proposal.proposalId).sort());
        assert.equal(perception.listSources(true, source.tenantId).length, 1);
        assert.equal(perception.listBriefs(10, source.tenantId).length, 1);
        assert.equal(harness.store.listArtifactsByTask("perception_reporting").length, 2);
        assert.ok(existsSync(exported.jsonArtifact.uri));
        assert.ok(existsSync(exported.markdownArtifact.uri));
        assert.ok(markdown.includes("Latency regression in rollout cohort"));
        assert.ok(markdown.includes("Support queue growth"));
        assert.ok(markdown.includes("investigate"));
    }
    finally {
        harness.cleanup();
    }
});
test("E2E: perception fail-closes when the billing plan does not include perception entitlement", () => {
    const harness = createE2EHarness("aa-e2e-perception-deny-");
    try {
        const billing = new BillingService(harness.db, harness.store);
        const account = billing.createAccount({
            accountId: "acct-perception-denied",
            ownerId: "owner-perception-denied",
            workspaceId: "workspace-perception-denied",
            planId: "pro",
            createdAt: "2026-04-24T11:10:00.000Z",
        });
        const perception = new PerceptionService(harness.db, harness.store, {
            billingService: billing,
        });
        let deniedError = null;
        try {
            perception.registerSource({
                sourceId: "source-perception-denied",
                tenantId: "tenant-perception-denied",
                type: "custom",
                name: "Denied Signals",
                accountId: account.accountId,
            });
        }
        catch (error) {
            deniedError = error;
        }
        assert.equal(deniedError?.name, "MonetizationError");
        assert.equal(deniedError?.code, "perception.feature_denied:billing.feature_not_in_plan");
        assert.equal(perception.listSources(false, "tenant-perception-denied").length, 0);
    }
    finally {
        harness.cleanup();
    }
});
//# sourceMappingURL=perception-intelligence-flow.test.js.map