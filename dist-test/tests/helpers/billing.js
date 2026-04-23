import { BillingService } from "../../src/scale-ecosystem/marketplace/billing-service.js";
export function seedBillingDataset(db, store) {
    const billing = new BillingService(db, store);
    billing.createAccount({
        accountId: "acct-pro-1",
        ownerId: "owner-pro-1",
        workspaceId: "workspace-pro-1",
        planId: "pro",
        createdAt: "2026-04-08T10:00:00.000Z",
    });
    billing.recordUsage({
        accountId: "acct-pro-1",
        metricType: "task_execution",
        quantity: 3,
        source: "runtime",
        capturedAt: "2026-04-08T10:10:00.000Z",
    });
    billing.recordUsage({
        accountId: "acct-pro-1",
        metricType: "premium_feature_activation",
        quantity: 2,
        source: "runtime",
        capturedAt: "2026-04-08T10:20:00.000Z",
    });
    billing.recordUsage({
        accountId: "acct-pro-1",
        metricType: "task_execution",
        quantity: 4,
        source: "runtime",
        capturedAt: "2026-03-12T10:00:00.000Z",
    });
}
//# sourceMappingURL=billing.js.map