import assert from "node:assert/strict";
import test from "node:test";
import { deriveProviderApiKeyEnvName, deriveProviderApiKeysJsonEnvNameForStartup, deriveProviderApiKeySecretRefEnvNameForStartup, deriveProviderApiKeySecretRefsJsonEnvNameForStartup, buildDefaultStartupConfigValidator, buildEnvironmentProviderReadinessProbe, createDefaultStartupConsistencyCheckerOptions, } from "../../../../../src/platform/execution/startup/startup-preflight.js";
// ─────────────────────────────────────────────────────────────────────────────
// Tests - deriveProviderApiKeyEnvName
// ─────────────────────────────────────────────────────────────────────────────
test("deriveProviderApiKeyEnvName returns correct env name", () => {
    assert.equal(deriveProviderApiKeyEnvName("anthropic"), "ANTHROPIC_API_KEY");
});
test("deriveProviderApiKeyEnvName handles camelCase", () => {
    assert.equal(deriveProviderApiKeyEnvName("openAI"), "OPEN_AI_API_KEY");
});
test("deriveProviderApiKeyEnvName handles mixed case", () => {
    assert.equal(deriveProviderApiKeyEnvName("MyProvider"), "MY_PROVIDER_API_KEY");
});
// ─────────────────────────────────────────────────────────────────────────────
// Tests - deriveProviderApiKeysJsonEnvNameForStartup
// ─────────────────────────────────────────────────────────────────────────────
test("deriveProviderApiKeysJsonEnvNameForStartup adds JSON suffix", () => {
    assert.equal(deriveProviderApiKeysJsonEnvNameForStartup("anthropic"), "ANTHROPIC_API_KEYS_JSON");
});
test("deriveProviderApiKeysJsonEnvNameForStartup handles camelCase", () => {
    assert.equal(deriveProviderApiKeysJsonEnvNameForStartup("openAI"), "OPEN_AI_API_KEYS_JSON");
});
// ─────────────────────────────────────────────────────────────────────────────
// Tests - deriveProviderApiKeySecretRefEnvNameForStartup
// ─────────────────────────────────────────────────────────────────────────────
test("deriveProviderApiKeySecretRefEnvNameForStartup adds secret ref suffix", () => {
    assert.equal(deriveProviderApiKeySecretRefEnvNameForStartup("anthropic"), "ANTHROPIC_API_KEY_SECRET_REF");
});
test("deriveProviderApiKeySecretRefEnvNameForStartup handles camelCase", () => {
    assert.equal(deriveProviderApiKeySecretRefEnvNameForStartup("openAI"), "OPEN_AI_API_KEY_SECRET_REF");
});
// ─────────────────────────────────────────────────────────────────────────────
// Tests - deriveProviderApiKeySecretRefsJsonEnvNameForStartup
// ─────────────────────────────────────────────────────────────────────────────
test("deriveProviderApiKeySecretRefsJsonEnvNameForStartup adds full suffix", () => {
    assert.equal(deriveProviderApiKeySecretRefsJsonEnvNameForStartup("anthropic"), "ANTHROPIC_API_KEY_SECRET_REFS_JSON");
});
test("deriveProviderApiKeySecretRefsJsonEnvNameForStartup handles camelCase", () => {
    assert.equal(deriveProviderApiKeySecretRefsJsonEnvNameForStartup("openAI"), "OPEN_AI_API_KEY_SECRET_REFS_JSON");
});
// ─────────────────────────────────────────────────────────────────────────────
// Tests - createDefaultStartupConsistencyCheckerOptions
// ─────────────────────────────────────────────────────────────────────────────
test("createDefaultStartupConsistencyCheckerOptions returns object with configValidator and providerReadinessProbe", () => {
    const options = createDefaultStartupConsistencyCheckerOptions();
    assert.ok(options.configValidator !== undefined);
    assert.ok(options.providerReadinessProbe !== undefined);
    assert.equal(typeof options.configValidator, "function");
    assert.equal(typeof options.providerReadinessProbe, "function");
});
test("createDefaultStartupConsistencyCheckerOptions accepts empty options", () => {
    const options = createDefaultStartupConsistencyCheckerOptions({});
    assert.ok(options.configValidator !== undefined);
    assert.ok(options.providerReadinessProbe !== undefined);
});
test("createDefaultStartupConsistencyCheckerOptions passes configRoot to factories", () => {
    // Just verify it doesn't throw and returns valid structure
    const options = createDefaultStartupConsistencyCheckerOptions({
        configRoot: "/test/config",
    });
    assert.ok(options.configValidator !== undefined);
    assert.ok(options.providerReadinessProbe !== undefined);
});
test("createDefaultStartupConsistencyCheckerOptions passes environment to factories", () => {
    const options = createDefaultStartupConsistencyCheckerOptions({
        environment: "test",
    });
    assert.ok(options.configValidator !== undefined);
    assert.ok(options.providerReadinessProbe !== undefined);
});
test("createDefaultStartupConsistencyCheckerOptions passes providerEnv to factories", () => {
    const options = createDefaultStartupConsistencyCheckerOptions({
        providerEnv: { TEST_API_KEY: "test-key" },
    });
    assert.ok(options.configValidator !== undefined);
    assert.ok(options.providerReadinessProbe !== undefined);
});
test("createDefaultStartupConsistencyCheckerOptions passes providerSecretResolver to factories", () => {
    const secretResolver = (ref) => `resolved-${ref}`;
    const options = createDefaultStartupConsistencyCheckerOptions({
        providerSecretResolver: secretResolver,
    });
    assert.ok(options.configValidator !== undefined);
    assert.ok(options.providerReadinessProbe !== undefined);
});
// ─────────────────────────────────────────────────────────────────────────────
// Tests - buildEnvironmentProviderReadinessProbe structure
// ─────────────────────────────────────────────────────────────────────────────
test("buildEnvironmentProviderReadinessProbe returns a function", () => {
    const probe = buildEnvironmentProviderReadinessProbe({});
    assert.equal(typeof probe, "function");
});
test("buildEnvironmentProviderReadinessProbe returns empty array when configValidation is null", () => {
    const probe = buildEnvironmentProviderReadinessProbe({});
    const results = probe(null);
    assert.deepStrictEqual(results, []);
});
test("buildEnvironmentProviderReadinessProbe returns empty array when configValidation.ok is false", () => {
    const probe = buildEnvironmentProviderReadinessProbe({});
    const results = probe({
        ok: false,
        environment: "test",
        configRoot: "/test",
        issues: ["some issue"],
        bundle: null,
    });
    assert.deepStrictEqual(results, []);
});
test("buildEnvironmentProviderReadinessProbe returns empty array when bundle is null", () => {
    const probe = buildEnvironmentProviderReadinessProbe({});
    const results = probe({
        ok: true,
        environment: "test",
        configRoot: "/test",
        issues: [],
        bundle: null,
    });
    assert.deepStrictEqual(results, []);
});
test("buildEnvironmentProviderReadinessProbe returns empty array when no defaultProvider", () => {
    const probe = buildEnvironmentProviderReadinessProbe({});
    const results = probe({
        ok: true,
        environment: "test",
        configRoot: "/test",
        issues: [],
        bundle: {
            configRoot: "/test",
            environment: "test",
            issues: [],
            layers: {
            // No providers.defaultProvider
            },
            version: { versionId: "v1", bundleHash: "hash", layerHashes: {} },
        },
    });
    assert.deepStrictEqual(results, []);
});
test("buildEnvironmentProviderReadinessProbe returns empty array when defaultProvider is empty string", () => {
    const probe = buildEnvironmentProviderReadinessProbe({});
    const results = probe({
        ok: true,
        environment: "test",
        configRoot: "/test",
        issues: [],
        bundle: {
            configRoot: "/test",
            environment: "test",
            issues: [],
            layers: {
                providers: {
                    defaultProvider: "",
                },
            },
            version: { versionId: "v1", bundleHash: "hash", layerHashes: {} },
        },
    });
    assert.deepStrictEqual(results, []);
});
test("buildEnvironmentProviderReadinessProbe returns empty array when defaultProvider is not a string", () => {
    const probe = buildEnvironmentProviderReadinessProbe({});
    const results = probe({
        ok: true,
        environment: "test",
        configRoot: "/test",
        issues: [],
        bundle: {
            configRoot: "/test",
            environment: "test",
            issues: [],
            layers: {
                providers: {
                    defaultProvider: 123,
                },
            },
            version: { versionId: "v1", bundleHash: "hash", layerHashes: {} },
        },
    });
    assert.deepStrictEqual(results, []);
});
// ─────────────────────────────────────────────────────────────────────────────
// Tests - buildDefaultStartupConfigValidator structure
// ─────────────────────────────────────────────────────────────────────────────
test("buildDefaultStartupConfigValidator returns a function", () => {
    const validator = buildDefaultStartupConfigValidator({});
    assert.equal(typeof validator, "function");
});
test("buildDefaultStartupConfigValidator returns an object with ok: false when config root is invalid", () => {
    // This will try to load config from a non-existent location
    const validator = buildDefaultStartupConfigValidator({
        configRoot: "/non/existent/path",
        providerEnv: {},
    });
    const result = validator();
    // Result should indicate failure since config can't load
    assert.equal(result.ok, false);
    assert.ok(result.issues.length > 0 || result.configRoot === "/non/existent/path");
});
test("buildDefaultStartupConfigValidator accepts providerEnv option", () => {
    const validator = buildDefaultStartupConfigValidator({
        providerEnv: { PATH: "/usr/bin" },
    });
    // Should return a result (may be ok or not depending on system state)
    const result = validator();
    assert.equal(typeof result.ok, "boolean");
    assert.ok(Array.isArray(result.issues));
});
test("buildDefaultStartupConfigValidator accepts environment option", () => {
    const validator = buildDefaultStartupConfigValidator({
        environment: "test",
    });
    const result = validator();
    assert.equal(result.environment, "test");
});
test("buildDefaultStartupConfigValidator returns structure with bundle", () => {
    const validator = buildDefaultStartupConfigValidator({
        configRoot: "/non/existent/path",
        providerEnv: {},
    });
    const result = validator();
    assert.equal(typeof result.environment, "string");
    assert.ok("configRoot" in result);
    assert.ok("issues" in result);
    assert.ok("bundle" in result);
});
//# sourceMappingURL=startup-preflight.test.js.map