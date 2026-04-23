import assert from "node:assert/strict";
import test from "node:test";
test("ModelProviderMetadata type accepts valid status values", () => {
    const provider = {
        status: "active",
        authMethods: ["api_key"],
    };
    assert.equal(provider.status, "active");
});
test("ModelProviderMetadata type accepts degraded status", () => {
    const provider = {
        status: "degraded",
        authMethods: ["oauth"],
    };
    assert.equal(provider.status, "degraded");
});
test("ModelProviderMetadata type accepts disabled status", () => {
    const provider = {
        status: "disabled",
        authMethods: [],
    };
    assert.equal(provider.status, "disabled");
});
test("ModelProviderMetadata type accepts deprecated status", () => {
    const provider = {
        status: "deprecated",
        authMethods: ["api_key"],
    };
    assert.equal(provider.status, "deprecated");
});
test("ModelProfileMetadata type accepts valid tier values", () => {
    const tiers = ["reasoning", "coding", "balanced", "fast"];
    assert.equal(tiers.length, 4);
});
test("ModelProfileMetadata type accepts valid metadataSource values", () => {
    const sources = [
        "bundled_snapshot",
        "local_override",
        "remote_refresh",
    ];
    assert.equal(sources.length, 3);
});
test("ModelProfileMetadata structure is correct", () => {
    const profile = {
        provider: "anthropic",
        modelId: "claude-3-5-sonnet",
        tier: "balanced",
        capabilities: ["text", "code"],
        contextWindowTokens: 200000,
        maxOutputTokens: 8192,
        pricing: {
            inputPer1kUsd: 0.003,
            outputPer1kUsd: 0.015,
        },
        metadataSource: "bundled_snapshot",
    };
    assert.equal(profile.provider, "anthropic");
    assert.equal(profile.tier, "balanced");
    assert.equal(profile.contextWindowTokens, 200000);
    assert.equal(profile.pricing.inputPer1kUsd, 0.003);
});
test("ModelMetadataRegistry structure is correct", () => {
    const registry = {
        version: "1.0.0",
        providers: {
            anthropic: { status: "active", authMethods: ["api_key"] },
        },
        profiles: {
            "claude-3-5-sonnet": {
                provider: "anthropic",
                modelId: "claude-3-5-sonnet",
                tier: "balanced",
                capabilities: ["text", "code"],
                contextWindowTokens: 200000,
                maxOutputTokens: 8192,
                pricing: { inputPer1kUsd: 0.003, outputPer1kUsd: 0.015 },
                metadataSource: "bundled_snapshot",
            },
        },
    };
    assert.equal(registry.version, "1.0.0");
    assert.ok(registry.providers["anthropic"]);
    assert.ok(registry.profiles["claude-3-5-sonnet"]);
});
//# sourceMappingURL=model-metadata-registry.test.js.map