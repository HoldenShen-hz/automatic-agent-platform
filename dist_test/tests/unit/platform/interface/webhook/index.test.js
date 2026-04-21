import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { WebhookIngressService } from "../../../../../src/platform/interface/webhook/index.js";
test("WebhookIngressService verifies signature and deduplicates repeated deliveries", () => {
    const service = new WebhookIngressService();
    service.registerEndpoint({
        endpointId: "github",
        source: "github",
        tenantId: "tenant-a",
        workspaceId: "workspace-a",
        enabled: true,
        allowedEventTypes: ["pull_request.opened"],
        algorithm: "sha256_hmac",
        signingSecret: "top-secret",
        dispatchTargetRef: "queue:webhook",
    });
    const body = JSON.stringify({
        eventType: "pull_request.opened",
        eventId: "evt-1",
        repository: "automatic-agent",
    });
    const signature = createHmac("sha256", "top-secret").update(body).digest("hex");
    const first = service.receive({
        endpointId: "github",
        headers: {
            "x-aa-signature": `sha256=${signature}`,
        },
        body,
    });
    const duplicate = service.receive({
        endpointId: "github",
        headers: {
            "x-aa-signature": `sha256=${signature}`,
        },
        body,
    });
    assert.equal(first.dispatchState, "accepted");
    assert.equal(first.signatureVerified, true);
    assert.equal(first.dispatchTargetRef, "queue:webhook");
    assert.equal(duplicate.dispatchState, "duplicate");
    assert.equal(service.listAcceptedEnvelopes().length, 1);
});
test("WebhookIngressService rejects event types outside endpoint allowlist", () => {
    const service = new WebhookIngressService();
    service.registerEndpoint({
        endpointId: "stripe",
        source: "stripe",
        tenantId: "tenant-a",
        workspaceId: null,
        enabled: true,
        allowedEventTypes: ["invoice.paid"],
        algorithm: "none",
    });
    assert.throws(() => {
        service.receive({
            endpointId: "stripe",
            headers: {
                "idempotency-key": "inv-1",
            },
            body: JSON.stringify({ eventType: "invoice.failed" }),
        });
    }, (error) => error instanceof Error && "code" in error && error.code === "webhook.event_type_not_allowed");
});
//# sourceMappingURL=index.test.js.map