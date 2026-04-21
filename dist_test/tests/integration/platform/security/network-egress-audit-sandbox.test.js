import test from "node:test";
import assert from "node:assert/strict";
import { NetworkEgressAuditService, getGlobalEgressAuditService, recordEgress, classifyUrl, } from "../../../../src/platform/control-plane/iam/network-egress-audit.js";
test("NetworkEgressAudit sandbox: records URL egress", () => {
    const service = new NetworkEgressAuditService();
    const event = service.recordEgress("https://example.com/api/data", "fetch", true);
    assert.ok(event.id.startsWith("egress_"));
    assert.equal(event.destinationType, "url");
    assert.equal(event.destination, "example.com");
    assert.equal(event.action, "fetch");
    assert.ok(event.success);
});
test("NetworkEgressAudit sandbox: records GitHub registry egress", () => {
    const service = new NetworkEgressAuditService();
    const event = service.recordEgress("https://github.com/user/repo", "git_clone", true);
    assert.equal(event.destinationType, "registry");
    assert.equal(event.destination, "github.com");
});
test("NetworkEgressAudit sandbox: records SSH egress for non-GitHub hosts", () => {
    const service = new NetworkEgressAuditService();
    const event = service.recordEgress("ssh://my-server.com", "git_push", true);
    assert.equal(event.destinationType, "ssh");
    assert.equal(event.destination, "my-server.com");
});
test("NetworkEgressAudit sandbox: records S3 egress", () => {
    const service = new NetworkEgressAuditService();
    const event = service.recordEgress("s3://my-bucket/data.json", "upload", true);
    assert.equal(event.destinationType, "s3");
    assert.equal(event.destination, "my-bucket");
});
test("NetworkEgressAudit sandbox: records failed egress with error code", () => {
    const service = new NetworkEgressAuditService();
    const event = service.recordEgress("https://example.com", "fetch", false, {
        errorCode: "TIMEOUT",
    });
    assert.ok(!event.success);
    assert.equal(event.errorCode, "TIMEOUT");
});
test("NetworkEgressAudit sandbox: classifies unknown protocols", () => {
    assert.equal(classifyUrl("ftp://example.com"), "unknown");
    assert.equal(classifyUrl("file:///etc/passwd"), "unknown");
});
test("NetworkEgressAudit sandbox: classifyUrl handles S3 with AWS hostname", () => {
    assert.equal(classifyUrl("https://my-bucket.s3.amazonaws.com"), "s3");
    assert.equal(classifyUrl("https://bucket.s3.eu-west-1.amazonaws.com"), "s3");
});
test("NetworkEgressAudit sandbox: global service records egress", () => {
    const service = getGlobalEgressAuditService();
    service.clearEvents();
    const event = recordEgress("https://api.example.com", "fetch", true);
    assert.ok(event.id);
    const events = service.getEvents();
    assert.ok(events.length > 0);
});
test("NetworkEgressAudit sandbox: records egress with metadata", () => {
    const service = new NetworkEgressAuditService();
    const event = service.recordEgress("https://example.com", "fetch", true, {
        metadata: { statusCode: 200, contentLength: 1024 },
    });
    assert.ok(event.metadata);
    assert.equal(event.metadata.statusCode, 200);
    assert.equal(event.metadata.contentLength, 1024);
});
test("NetworkEgressAudit sandbox: getEventsByType filters correctly", () => {
    const service = new NetworkEgressAuditService();
    service.clearEvents();
    service.recordEgress("https://example.com", "fetch", true);
    service.recordEgress("ssh://server.com", "ssh", true);
    service.recordEgress("s3://bucket/file", "upload", true);
    const urlEvents = service.getEventsByType("url");
    const sshEvents = service.getEventsByType("ssh");
    const s3Events = service.getEventsByType("s3");
    assert.equal(urlEvents.length, 1);
    assert.equal(sshEvents.length, 1);
    assert.equal(s3Events.length, 1);
});
test("NetworkEgressAudit sandbox: getFailedEvents returns only failed", () => {
    const service = new NetworkEgressAuditService();
    service.clearEvents();
    service.recordEgress("https://example.com", "fetch", true);
    service.recordEgress("https://fail.com", "fetch", false, { errorCode: "CONNECTION_REFUSED" });
    const failedEvents = service.getFailedEvents();
    assert.equal(failedEvents.length, 1);
    assert.equal(failedEvents[0].destination, "fail.com");
});
test("NetworkEgressAudit sandbox: getFailedEvents returns empty when all succeed", () => {
    const service = new NetworkEgressAuditService();
    service.clearEvents();
    service.recordEgress("https://example.com", "fetch", true);
    service.recordEgress("https://example.org", "fetch", true);
    const failedEvents = service.getFailedEvents();
    assert.equal(failedEvents.length, 0);
});
//# sourceMappingURL=network-egress-audit-sandbox.test.js.map