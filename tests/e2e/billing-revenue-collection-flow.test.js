import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { BillingService } from "../../src/scale-ecosystem/billing/billing-service.js";
import { createE2EHarness } from "../helpers/e2e-harness.js";
test("E2E: billing turns entitled usage into invoice collection and exported account evidence", async () => {
    const harness = createE2EHarness("aa-e2e-billing-flow-");
    const artifactRoot = join(harness.workspace, "artifacts");
    try {
        const billing = new BillingService(harness.db, harness.store, {
            artifactStoreOptions: {
                rootDir: artifactRoot,
            },
        });
        const account = billing.createAccount({
            accountId: "acct-billing-e2e",
            ownerId: "owner-billing-e2e",
            workspaceId: "workspace-billing-e2e",
            planId: "pro",
            createdAt: "2026-04-24T10:00:00.000Z",
        });
        const entitlement = billing.evaluateEntitlement({
            accountId: account.accountId,
            featureKey: "phase3.billing_export",
            metricType: "task_execution",
            requestedQuantity: 10,
            evaluatedAt: "2026-04-24T10:01:00.000Z",
        });
        billing.recordUsage({
            accountId: account.accountId,
            metricType: "task_execution",
            quantity: 5,
            source: "runtime",
            capturedAt: "2026-04-24T10:02:00.000Z",
        });
        billing.recordUsage({
            accountId: account.accountId,
            metricType: "premium_feature_activation",
            quantity: 2,
            source: "runtime",
            capturedAt: "2026-04-24T10:03:00.000Z",
        });
        const invoice = billing.createInvoice({
            accountId: account.accountId,
            createdAt: "2026-04-24T10:04:00.000Z",
            dueAt: "2026-05-01T00:00:00.000Z",
            taxUsd: 0,
        });
        const checkout = await billing.createCheckoutSession({
            invoiceId: invoice.invoiceId,
            createdAt: "2026-04-24T10:05:00.000Z",
        });
        const reconciled = billing.reconcilePaymentSession({
            gatewayKind: checkout.gatewayKind,
            gatewaySessionRef: checkout.gatewaySessionRef,
            status: "paid",
            occurredAt: "2026-04-24T10:06:00.000Z",
        });
        const summary = billing.buildAccountSummary(account.accountId);
        const exported = billing.exportAccountSummary(account.accountId);
        const invoices = billing.listInvoices(account.accountId);
        const sessions = billing.listPaymentSessions(invoice.invoiceId);
        const markdown = readFileSync(exported.markdownArtifact.uri, "utf8");
        assert.equal(entitlement.decision.allowed, 1);
        assert.equal(entitlement.decision.decisionType, "allow");
        assert.equal(entitlement.remainingQuantity, 990);
        assert.equal(invoice.status, "open");
        assert.equal(checkout.status, "pending");
        assert.ok(checkout.checkoutUrl.includes(invoice.invoiceId));
        assert.equal(reconciled.session.status, "paid");
        assert.equal(reconciled.invoice.status, "paid");
        assert.equal(summary.totals.usageEventCount, 2);
        assert.equal(summary.totals.ledgerEntryCount, 3);
        assert.equal(summary.totals.totalBilledUsd, 0);
        assert.equal(summary.recentDecisions.length, 1);
        assert.equal(invoices.length, 1);
        assert.equal(sessions.length, 1);
        assert.equal(sessions[0]?.status, "paid");
        assert.equal(harness.store.listArtifactsByTask("billing_reporting").length, 2);
        assert.ok(existsSync(exported.jsonArtifact.uri));
        assert.ok(existsSync(exported.markdownArtifact.uri));
        assert.ok(markdown.includes("acct-billing-e2e"));
        assert.ok(markdown.includes("# Billing Account Summary"));
    }
    finally {
        harness.cleanup();
    }
});
//# sourceMappingURL=billing-revenue-collection-flow.test.js.map