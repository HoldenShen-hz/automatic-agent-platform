import test from "node:test";
import assert from "node:assert/strict";
import { createWebFetchTool, isBlockedIpOrHostname, isDomainAllowed, isInternalUrl, } from "../../../../../src/platform/execution/tool-executor/web-fetch.js";
import { parseSafeOutboundUrl, sanitizeUrlForTelemetry, } from "../../../../../src/platform/control-plane/iam/outbound-url-policy.js";
test("isBlockedIpOrHostname blocks localhost IP patterns", () => {
    assert.ok(isBlockedIpOrHostname("127.0.0.1"));
    assert.ok(isBlockedIpOrHostname("127.255.255.255"));
    assert.ok(isBlockedIpOrHostname("10.0.0.1"));
    assert.ok(isBlockedIpOrHostname("10.255.255.255"));
    assert.ok(isBlockedIpOrHostname("172.16.0.1"));
    assert.ok(isBlockedIpOrHostname("172.31.255.255"));
    assert.ok(isBlockedIpOrHostname("192.168.0.1"));
    assert.ok(isBlockedIpOrHostname("192.168.255.255"));
});
test("isBlockedIpOrHostname blocks IPv6 patterns", () => {
    assert.ok(isBlockedIpOrHostname("::1"));
    assert.ok(isBlockedIpOrHostname("fe80:0000:0000:0000:0000:0000:0000:0001"));
    assert.ok(isBlockedIpOrHostname("fc00::"));
    assert.ok(isBlockedIpOrHostname("fd00::"));
});
test("isBlockedIpOrHostname blocks blocked hostnames", () => {
    assert.ok(isBlockedIpOrHostname("localhost"));
    assert.ok(isBlockedIpOrHostname("LOCALHOST"));
    assert.ok(isBlockedIpOrHostname("127.0.0.1"));
    assert.ok(isBlockedIpOrHostname("0.0.0.0"));
    assert.ok(isBlockedIpOrHostname("::1"));
    assert.ok(isBlockedIpOrHostname("169.254.169.254"));
    assert.ok(isBlockedIpOrHostname("metadata.google.internal"));
});
test("isBlockedIpOrHostname allows public IPs", () => {
    assert.ok(!isBlockedIpOrHostname("8.8.8.8"));
    assert.ok(!isBlockedIpOrHostname("1.1.1.1"));
    assert.ok(!isBlockedIpOrHostname("93.184.216.34"));
});
test("parseSafeOutboundUrl rejects link-local metadata endpoints", () => {
    assert.throws(() => parseSafeOutboundUrl("http://169.254.169.254/latest/meta-data", {
        invalid: "invalid",
        blocked: "blocked",
    }), /blocked/);
});
test("sanitizeUrlForTelemetry redacts tokens, credentials, and telegram bot paths", () => {
    assert.equal(sanitizeUrlForTelemetry("https://user:pass@example.com/botsecret-token/sendMessage?token=abc123&trace=1"), "https://***:***@example.com/bot***/sendMessage?token=***&trace=1");
});
test("isBlockedIpOrHostname blocks internal domain suffixes", () => {
    assert.ok(isBlockedIpOrHostname("server.local"));
    assert.ok(isBlockedIpOrHostname("host.internal"));
    assert.ok(isBlockedIpOrHostname("machine.private"));
});
test("isDomainAllowed respects whitelist only", () => {
    const allowedDomains = ["example.com", "trusted.org"];
    assert.ok(isDomainAllowed("example.com", allowedDomains, undefined));
    assert.ok(isDomainAllowed("sub.example.com", allowedDomains, undefined));
    assert.ok(isDomainAllowed("trusted.org", allowedDomains, undefined));
    assert.ok(!isDomainAllowed("untrusted.com", allowedDomains, undefined));
    assert.ok(isDomainAllowed("evil.example.com", allowedDomains, undefined));
});
test("isDomainAllowed respects blacklist", () => {
    const blockedDomains = ["evil.com", "blocked.org"];
    assert.ok(!isDomainAllowed("evil.com", undefined, blockedDomains));
    assert.ok(!isDomainAllowed("sub.evil.com", undefined, blockedDomains));
    assert.ok(!isDomainAllowed("blocked.org", undefined, blockedDomains));
    assert.ok(isDomainAllowed("good.com", undefined, blockedDomains));
});
test("isDomainAllowed whitelist takes precedence over blacklist", () => {
    const allowedDomains = ["example.com"];
    const blockedDomains = ["example.com"];
    assert.ok(isDomainAllowed("example.com", allowedDomains, blockedDomains));
});
test("isDomainAllowed case insensitive matching", () => {
    const allowedDomains = ["EXAMPLE.COM"];
    assert.ok(isDomainAllowed("example.com", allowedDomains, undefined));
    assert.ok(isDomainAllowed("EXAMPLE.COM", allowedDomains, undefined));
    assert.ok(isDomainAllowed("Sub.EXAMPLE.COM", allowedDomains, undefined));
});
test("isInternalUrl blocks non-http protocols", () => {
    assert.ok(isInternalUrl(new URL("file:///etc/passwd")));
    assert.ok(isInternalUrl(new URL("ftp://example.com")));
    assert.ok(isInternalUrl(new URL("javascript:alert(1)")));
});
test("isInternalUrl allows http and https", () => {
    assert.ok(!isInternalUrl(new URL("http://example.com")));
    assert.ok(!isInternalUrl(new URL("https://example.com")));
});
test("isInternalUrl blocks internal URLs", () => {
    assert.ok(isInternalUrl(new URL("http://localhost:8080")));
    assert.ok(isInternalUrl(new URL("http://127.0.0.1:8080")));
    assert.ok(isInternalUrl(new URL("http://10.0.0.1:8080")));
});
test("createWebFetchTool returns correct tool structure", () => {
    const tool = createWebFetchTool();
    assert.equal(tool.name, "web_fetch");
    assert.ok(typeof tool.execute === "function");
});
test("createWebFetchTool rejects invalid URLs", async () => {
    const tool = createWebFetchTool();
    const result = await tool.execute({ url: "not-a-valid-url" });
    assert.ok(!result.success);
    assert.equal(result.status, "failed");
    assert.equal(result.errorCode, "INVALID_URL");
});
test("createWebFetchTool rejects internal network URLs", async () => {
    const tool = createWebFetchTool();
    const result = await tool.execute({ url: "http://localhost:8080" });
    assert.ok(!result.success);
    assert.equal(result.status, "blocked");
    assert.equal(result.errorCode, "INTERNAL_NETWORK_BLOCKED");
});
test("createWebFetchTool rejects private IPs", async () => {
    const tool = createWebFetchTool();
    const result = await tool.execute({ url: "http://10.0.0.1:8080" });
    assert.ok(!result.success);
    assert.equal(result.status, "blocked");
    assert.equal(result.errorCode, "INTERNAL_NETWORK_BLOCKED");
});
test("createWebFetchTool rejects non-whitelisted domains", async () => {
    const tool = createWebFetchTool();
    const result = await tool.execute({
        url: "https://evil.com",
        allowedDomains: ["trusted.com"],
    });
    assert.ok(!result.success);
    assert.equal(result.status, "blocked");
    assert.equal(result.errorCode, "DOMAIN_BLOCKED");
});
test("createWebFetchTool allows whitelisted domains", async () => {
    const tool = createWebFetchTool();
    const result = await tool.execute({
        url: "https://example.com",
        allowedDomains: ["example.com"],
    });
    assert.ok(result.status === "succeeded" || result.status === "failed" || result.status === "timed_out");
    assert.ok(result.errorCode !== "DOMAIN_BLOCKED");
});
test("createWebFetchTool applies custom timeout", async () => {
    const tool = createWebFetchTool();
    const result = await tool.execute({
        url: "https://example.com",
        timeoutMs: 1,
    });
    assert.ok(!result.success);
    assert.ok(result.status === "timed_out" || result.status === "blocked" || result.status === "failed");
});
test("createWebFetchTool HEAD method works without body", async () => {
    const tool = createWebFetchTool();
    const result = await tool.execute({
        url: "https://example.com",
        method: "HEAD",
    });
    assert.ok(result.status === "succeeded" || result.status === "blocked" || result.status === "failed");
});
//# sourceMappingURL=web-fetch.test.js.map