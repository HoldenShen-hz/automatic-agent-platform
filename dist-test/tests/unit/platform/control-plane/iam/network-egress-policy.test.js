import assert from "node:assert/strict";
import test from "node:test";
import { createPolicyAwareFetch, loadNetworkEgressPolicyConfigFromEnv, NetworkEgressPolicyService, } from "../../../../../src/platform/control-plane/iam/network-egress-policy.js";
import { PolicyDeniedError } from "../../../../../src/platform/contracts/errors.js";
test("loadNetworkEgressPolicyConfigFromEnv returns audit_only mode by default", () => {
    const config = loadNetworkEgressPolicyConfigFromEnv({});
    assert.equal(config.mode, "audit_only");
    assert.equal(config.enabled, true);
});
test("loadNetworkEgressPolicyConfigFromEnv parses enforce mode", () => {
    const config = loadNetworkEgressPolicyConfigFromEnv({ AA_EGRESS_POLICY_MODE: "enforce" });
    assert.equal(config.mode, "enforce");
});
test("loadNetworkEgressPolicyConfigFromEnv parses disabled", () => {
    const config = loadNetworkEgressPolicyConfigFromEnv({ AA_EGRESS_POLICY_ENABLED: "0" });
    assert.equal(config.enabled, false);
});
test("loadNetworkEgressPolicyConfigFromEnv parses allowed domains", () => {
    const config = loadNetworkEgressPolicyConfigFromEnv({ AA_EGRESS_ALLOWED_DOMAINS: "example.com, *.api.example.com" });
    assert.deepEqual(config.allowedDomains, ["example.com", "*.api.example.com"]);
});
test("loadNetworkEgressPolicyConfigFromEnv parses blocked domains", () => {
    const config = loadNetworkEgressPolicyConfigFromEnv({ AA_EGRESS_BLOCKED_DOMAINS: "evil.com, malware.com" });
    assert.deepEqual(config.blockedDomains, ["evil.com", "malware.com"]);
});
test("loadNetworkEgressPolicyConfigFromEnv parses allowed types", () => {
    const config = loadNetworkEgressPolicyConfigFromEnv({ AA_EGRESS_ALLOWED_TYPES: "url, ssh, s3" });
    assert.deepEqual(config.allowedDestinationTypes, ["url", "ssh", "s3"]);
});
test("loadNetworkEgressPolicyConfigFromEnv parses blocked types", () => {
    const config = loadNetworkEgressPolicyConfigFromEnv({ AA_EGRESS_BLOCKED_TYPES: "registry, publish" });
    assert.deepEqual(config.blockedDestinationTypes, ["registry", "publish"]);
});
test("loadNetworkEgressPolicyConfigFromEnv parses allow internal hosts", () => {
    const config = loadNetworkEgressPolicyConfigFromEnv({ AA_EGRESS_ALLOW_INTERNAL: "1" });
    assert.equal(config.allowInternalHosts, true);
});
test("loadNetworkEgressPolicyConfigFromEnv ignores invalid destination types", () => {
    const config = loadNetworkEgressPolicyConfigFromEnv({ AA_EGRESS_ALLOWED_TYPES: "url, invalid, ssh" });
    assert.deepEqual(config.allowedDestinationTypes, ["url", "ssh"]);
});
test("NetworkEgressPolicyService defaults to enabled and audit_only", () => {
    const policy = new NetworkEgressPolicyService();
    assert.equal(policy.getMode(), "audit_only");
});
test("NetworkEgressPolicyService evaluate allows any URL when disabled", () => {
    const policy = new NetworkEgressPolicyService({ enabled: false });
    const decision = policy.evaluate("https://example.com");
    assert.equal(decision.allowed, true);
    assert.equal(decision.reasonCode, null);
});
test("NetworkEgressPolicyService evaluate allows public URLs in audit mode", () => {
    const policy = new NetworkEgressPolicyService({ mode: "audit_only" });
    const decision = policy.evaluate("https://example.com/path");
    assert.equal(decision.allowed, true);
});
test("NetworkEgressPolicyService evaluate blocks internal hostnames in enforce mode", () => {
    const policy = new NetworkEgressPolicyService({ mode: "enforce", allowInternalHosts: false });
    const decision = policy.evaluate("https://127.0.0.1/api");
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "EGRESS_INTERNAL_BLOCKED");
});
test("NetworkEgressPolicyService evaluate allows internal hostnames when configured", () => {
    const policy = new NetworkEgressPolicyService({ mode: "enforce", allowInternalHosts: true });
    const decision = policy.evaluate("https://127.0.0.1/api");
    assert.equal(decision.allowed, true);
});
test("NetworkEgressPolicyService evaluate blocks localhost", () => {
    const policy = new NetworkEgressPolicyService({ mode: "enforce", allowInternalHosts: false });
    const decision = policy.evaluate("https://localhost/api");
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "EGRESS_INTERNAL_BLOCKED");
});
test("NetworkEgressPolicyService evaluate blocks .local domains", () => {
    const policy = new NetworkEgressPolicyService({ mode: "enforce", allowInternalHosts: false });
    const decision = policy.evaluate("https://server.local/api");
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "EGRESS_INTERNAL_BLOCKED");
});
test("NetworkEgressPolicyService evaluate blocks 10.x.x.x networks", () => {
    const policy = new NetworkEgressPolicyService({ mode: "enforce", allowInternalHosts: false });
    const decision = policy.evaluate("https://10.0.0.1/api");
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "EGRESS_INTERNAL_BLOCKED");
});
test("NetworkEgressPolicyService evaluate blocks 172.16-31.x.x networks", () => {
    const policy = new NetworkEgressPolicyService({ mode: "enforce", allowInternalHosts: false });
    const decision = policy.evaluate("https://172.20.0.1/api");
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "EGRESS_INTERNAL_BLOCKED");
});
test("NetworkEgressPolicyService evaluate blocks 192.168.x.x networks", () => {
    const policy = new NetworkEgressPolicyService({ mode: "enforce", allowInternalHosts: false });
    const decision = policy.evaluate("https://192.168.1.1/api");
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "EGRESS_INTERNAL_BLOCKED");
});
test("NetworkEgressPolicyService evaluate blocks specified destination types", () => {
    const policy = new NetworkEgressPolicyService({ mode: "enforce", blockedDestinationTypes: ["ssh"] });
    const decision = policy.evaluate("ssh://example.com");
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "EGRESS_TYPE_BLOCKED");
});
test("NetworkEgressPolicyService evaluate blocks blocked domains", () => {
    const policy = new NetworkEgressPolicyService({ mode: "enforce", blockedDomains: ["evil.com"] });
    const decision = policy.evaluate("https://evil.com/api");
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "EGRESS_DOMAIN_BLOCKED");
});
test("NetworkEgressPolicyService evaluate blocks subdomain of blocked domain", () => {
    const policy = new NetworkEgressPolicyService({ mode: "enforce", blockedDomains: ["evil.com"] });
    const decision = policy.evaluate("https://api.evil.com/path");
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "EGRESS_DOMAIN_BLOCKED");
});
test("NetworkEgressPolicyService evaluate allows subdomain of allowed domain", () => {
    // Note: *.pattern isn't a wildcard - it's treated literally
    // But api.example.com ends with .example.com, so it matches example.com
    const policy = new NetworkEgressPolicyService({ mode: "enforce", allowedDomains: ["example.com"] });
    const decision = policy.evaluate("https://api.example.com/endpoint");
    assert.equal(decision.allowed, true);
});
test("NetworkEgressPolicyService evaluate returns destination type in decision", () => {
    const policy = new NetworkEgressPolicyService({ mode: "enforce" });
    const decision = policy.evaluate("https://example.com/api");
    assert.equal(decision.destinationType, "url");
    assert.ok(decision.destination.length > 0);
});
test("NetworkEgressPolicyService evaluate allows when only allowed types match", () => {
    const policy = new NetworkEgressPolicyService({
        mode: "enforce",
        allowedDestinationTypes: ["ssh"],
    });
    const decision = policy.evaluate("ssh://example.com");
    assert.equal(decision.allowed, true);
});
test("NetworkEgressPolicyService evaluate blocks when type not in allowed types", () => {
    const policy = new NetworkEgressPolicyService({
        mode: "enforce",
        allowedDestinationTypes: ["ssh"],
    });
    const decision = policy.evaluate("https://example.com");
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "EGRESS_TYPE_NOT_ALLOWED");
});
test("NetworkEgressPolicyService evaluate returns reasonCode null when allowed", () => {
    const policy = new NetworkEgressPolicyService({ mode: "enforce" });
    const decision = policy.evaluate("https://example.com");
    assert.equal(decision.reasonCode, null);
});
test("NetworkEgressPolicyService evaluate is case-insensitive for hostnames", () => {
    const policy = new NetworkEgressPolicyService({ mode: "enforce", blockedDomains: ["EVIL.COM"] });
    const decision = policy.evaluate("https://evil.com/path");
    assert.equal(decision.allowed, false);
});
test("NetworkEgressPolicyService record does not throw", () => {
    const policy = new NetworkEgressPolicyService();
    assert.doesNotThrow(() => policy.record("https://example.com", "fetch", true));
});
test("NetworkEgressPolicyService record accepts error code and metadata", () => {
    const policy = new NetworkEgressPolicyService();
    assert.doesNotThrow(() => policy.record("https://example.com", "fetch", false, {
        errorCode: "EGRESS_BLOCKED",
        metadata: { reason: "test" },
    }));
});
test("createPolicyAwareFetch throws egress.blocked when policy denies request", async () => {
    const policy = new NetworkEgressPolicyService({
        mode: "enforce",
        blockedDomains: ["evil.example.test"],
    });
    let fetchCalled = false;
    const dummyFetch = async () => {
        fetchCalled = true;
        return new Response("ok", { status: 200 });
    };
    const policyFetch = createPolicyAwareFetch(dummyFetch, {
        action: "test_fetch",
        policy,
    });
    await assert.rejects(async () => policyFetch("https://evil.example.test/api"), (error) => error instanceof PolicyDeniedError &&
        error.code === "egress.blocked" &&
        error.message.startsWith("egress.blocked:EGRESS_DOMAIN_BLOCKED") &&
        error.details?.destination === "evil.example.test" &&
        error.details?.reasonCode === "EGRESS_DOMAIN_BLOCKED");
    assert.equal(fetchCalled, false, "Underlying fetch should not be called when blocked");
});
test("createPolicyAwareFetch throws egress.blocked for internal hosts in enforce mode", async () => {
    const policy = new NetworkEgressPolicyService({
        mode: "enforce",
        allowInternalHosts: false,
    });
    const dummyFetch = async () => {
        return new Response("ok");
    };
    const policyFetch = createPolicyAwareFetch(dummyFetch, {
        action: "test_fetch",
        policy,
    });
    await assert.rejects(async () => policyFetch("https://127.0.0.1/api"), (error) => error instanceof PolicyDeniedError &&
        error.code === "egress.blocked" &&
        error.message.includes("egress.blocked:EGRESS_INTERNAL_BLOCKED"));
});
test("createPolicyAwareFetch allows requests that pass policy evaluation", async () => {
    const policy = new NetworkEgressPolicyService({
        mode: "enforce",
        blockedDomains: ["evil.example.test"],
    });
    let fetchCalled = false;
    const dummyFetch = async () => {
        fetchCalled = true;
        return new Response("allowed", { status: 200 });
    };
    const policyFetch = createPolicyAwareFetch(dummyFetch, {
        action: "test_fetch",
        policy,
    });
    const response = await policyFetch("https://safe.example.test/api");
    assert.equal(fetchCalled, true);
    assert.equal(response.status, 200);
});
//# sourceMappingURL=network-egress-policy.test.js.map