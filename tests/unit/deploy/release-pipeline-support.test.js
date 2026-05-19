/**
 * Release Pipeline Support Tests
 *
 * Tests for the sanitization and utility functions in release-pipeline-support.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeVersion, sanitizeCommitSha, sanitizeRegistry, sanitizeImageRepository, sanitizeSecretRef, sanitizeConfigBundleRef, buildMarkdown, buildExecutionMarkdown, } from "../../../src/platform/control-plane/incident-control/release-pipeline-support.js";
test("sanitizeVersion accepts valid semver with v prefix", () => {
    assert.equal(sanitizeVersion("v1.2.3"), "v1.2.3");
    assert.equal(sanitizeVersion("v1.0.0-alpha"), "v1.0.0-alpha");
    assert.equal(sanitizeVersion("v2.3.4-beta.1"), "v2.3.4-beta.1");
});
test("sanitizeVersion accepts valid semver without v prefix", () => {
    assert.equal(sanitizeVersion("1.2.3"), "v1.2.3");
    assert.equal(sanitizeVersion("0.0.1"), "v0.0.1");
    assert.equal(sanitizeVersion("10.20.30"), "v10.20.30");
});
test("sanitizeVersion accepts semver with build metadata", () => {
    assert.equal(sanitizeVersion("v1.0.0+build.123"), "v1.0.0+build.123");
    assert.equal(sanitizeVersion("1.2.3+abc"), "v1.2.3+abc");
});
test("sanitizeVersion accepts semver with prerelease metadata", () => {
    assert.equal(sanitizeVersion("v1.0.0-rc.1"), "v1.0.0-rc.1");
    // Note: +build metadata not supported - regex only allows [-A-Za-z0-9.] in prerelease/build portion
    assert.throws(() => sanitizeVersion("2.0.0-beta.2+build"), /ValidationError/);
});
test("sanitizeVersion rejects invalid versions", () => {
    assert.throws(() => sanitizeVersion("invalid"), /ValidationError/);
    assert.throws(() => sanitizeVersion("1.2"), /ValidationError/);
    assert.throws(() => sanitizeVersion("1.2.3.4"), /ValidationError/);
    assert.throws(() => sanitizeVersion(""), /ValidationError/);
    assert.throws(() => sanitizeVersion("v1.2.a"), /ValidationError/);
});
test("sanitizeVersion trims whitespace", () => {
    assert.equal(sanitizeVersion("  v1.2.3  "), "v1.2.3");
    assert.equal(sanitizeVersion("\tv1.0.0\n"), "v1.0.0");
});
test("sanitizeCommitSha accepts valid 7-char SHA", () => {
    assert.equal(sanitizeCommitSha("abcdef1"), "abcdef1");
    assert.equal(sanitizeCommitSha("ABCDEF1"), "abcdef1"); // converted to lowercase
    assert.equal(sanitizeCommitSha("1234567"), "1234567");
});
test("sanitizeCommitSha accepts valid 40-char SHA", () => {
    const sha = "abcdef1234567890abcdef1234567890abcdef12";
    assert.equal(sanitizeCommitSha(sha), sha.toLowerCase());
});
test("sanitizeCommitSha accepts SHA in between 7 and 40 chars", () => {
    assert.equal(sanitizeCommitSha("abcdef123456"), "abcdef123456");
    assert.equal(sanitizeCommitSha("abcdeff"), "abcdeff");
});
test("sanitizeCommitSha rejects invalid SHAs", () => {
    assert.throws(() => sanitizeCommitSha("invalid"), /ValidationError/);
    assert.throws(() => sanitizeCommitSha("abcdefg"), /ValidationError/); // 7 chars but not hex
    assert.throws(() => sanitizeCommitSha(""), /ValidationError/);
    assert.throws(() => sanitizeCommitSha("abcdef"), /ValidationError/); // too short
    assert.throws(() => sanitizeCommitSha("abcdefgh"), /ValidationError/); // 8 chars, invalid length
});
test("sanitizeCommitSha converts to lowercase", () => {
    assert.equal(sanitizeCommitSha("ABCDEF12"), "abcdef12");
    assert.equal(sanitizeCommitSha("AbCdEf12"), "abcdef12");
});
test("sanitizeCommitSha trims whitespace", () => {
    assert.equal(sanitizeCommitSha("  abcdef1  "), "abcdef1");
});
test("sanitizeRegistry accepts valid registry URLs", () => {
    assert.equal(sanitizeRegistry("ghcr.io"), "ghcr.io");
    assert.equal(sanitizeRegistry("docker.io"), "docker.io");
    assert.equal(sanitizeRegistry("registry.example.com"), "registry.example.com");
});
test("sanitizeRegistry accepts registry with path", () => {
    assert.equal(sanitizeRegistry("ghcr.io/automatic-agent"), "ghcr.io/automatic-agent");
    assert.equal(sanitizeRegistry("docker.io/library"), "docker.io/library");
});
test("sanitizeRegistry strips trailing slashes", () => {
    assert.equal(sanitizeRegistry("ghcr.io/"), "ghcr.io");
    assert.equal(sanitizeRegistry("docker.io/library/"), "docker.io/library");
});
test("sanitizeRegistry rejects invalid registries", () => {
    assert.throws(() => sanitizeRegistry(""), /ValidationError/);
    assert.throws(() => sanitizeRegistry("invalid URL"), /ValidationError/);
    assert.throws(() => sanitizeRegistry("https://ghcr.io"), /ValidationError/);
});
test("sanitizeRegistry trims whitespace", () => {
    assert.equal(sanitizeRegistry("  ghcr.io  "), "ghcr.io");
});
test("sanitizeImageRepository accepts valid repository paths", () => {
    assert.equal(sanitizeImageRepository("automatic-agent/platform"), "automatic-agent/platform");
    assert.equal(sanitizeImageRepository("library/nginx"), "library/nginx");
    assert.equal(sanitizeImageRepository("a/b/c/d"), "a/b/c/d");
});
test("sanitizeImageRepository strips leading and trailing slashes", () => {
    assert.equal(sanitizeImageRepository("/automatic-agent/"), "automatic-agent");
    // Empty result after stripping fails validation
    assert.throws(() => sanitizeImageRepository("///"), /ValidationError/);
});
test("sanitizeImageRepository rejects invalid repository paths", () => {
    assert.throws(() => sanitizeImageRepository(""), /ValidationError/);
    assert.throws(() => sanitizeImageRepository("invalid path"), /ValidationError/);
});
test("sanitizeSecretRef accepts valid secret URIs", () => {
    assert.equal(sanitizeSecretRef("secret://system/registry", "code"), "secret://system/registry");
    assert.equal(sanitizeSecretRef("secret://system/deploy/kubeconfig", "code"), "secret://system/deploy/kubeconfig");
});
test("sanitizeSecretRef rejects invalid secret URIs", () => {
    assert.throws(() => sanitizeSecretRef("invalid", "code"), /ValidationError/);
    assert.throws(() => sanitizeSecretRef("secret://", "code"), /ValidationError/);
    assert.throws(() => sanitizeSecretRef("", "code"), /ValidationError/);
    assert.throws(() => sanitizeSecretRef("http://example.com", "code"), /ValidationError/);
});
test("sanitizeSecretRef error code includes secret ref", () => {
    try {
        sanitizeSecretRef("bad-ref", "my_code");
        assert.fail("Should throw");
    }
    catch (err) {
        const error = err;
        assert.ok(error.message?.includes("bad-ref"), "Error code should include the secret ref");
    }
});
test("sanitizeConfigBundleRef accepts valid config bundle URIs", () => {
    assert.equal(sanitizeConfigBundleRef("config-bundle://runtime/prod"), "config-bundle://runtime/prod");
    assert.equal(sanitizeConfigBundleRef("config-bundle://config/default"), "config-bundle://config/default");
});
test("sanitizeConfigBundleRef rejects invalid config bundle URIs", () => {
    assert.throws(() => sanitizeConfigBundleRef("invalid"), /ValidationError/);
    assert.throws(() => sanitizeConfigBundleRef("config-bundle://"), /ValidationError/);
    assert.throws(() => sanitizeConfigBundleRef(""), /ValidationError/);
    assert.throws(() => sanitizeConfigBundleRef("http://example.com"), /ValidationError/);
});
test("buildMarkdown creates correct markdown output", () => {
    const bundle = {
        bundleId: "test-bundle-123",
        generatedAt: "2026-04-26T00:00:00.000Z",
        environment: "prod",
        version: "v1.2.3",
        commitSha: "abcdef12",
        imageTag: "v1.2.3-abcdef12",
        imageRef: "ghcr.io/automatic-agent/platform:v1.2.3-abcdef12",
        imageRepository: "automatic-agent/platform",
        rolloutStrategy: "canary",
        deploymentNamespace: "production",
        clusterName: "prod-cluster",
        configPath: "config/prod",
        configBundleRef: "config-bundle://runtime/prod",
        registryCredentialRef: "secret://system/registry",
        deploymentCredentialRef: "secret://system/deploy",
        publishWorkflowPath: ".github/workflows/publish.yml",
        deployWorkflowPath: ".github/workflows/deploy.yml",
        requiredReadinessChecks: ["check1", "check2"],
        recommendedCommands: ["cmd1", "cmd2"],
    };
    const markdown = buildMarkdown(bundle);
    assert.ok(markdown.includes("# Release Pipeline Bundle"), "Should have title");
    assert.ok(markdown.includes("test-bundle-123"), "Should include bundleId");
    assert.ok(markdown.includes("prod"), "Should include environment");
    assert.ok(markdown.includes("v1.2.3"), "Should include version");
    assert.ok(markdown.includes("abcdef12"), "Should include commitSha");
    assert.ok(markdown.includes("canary"), "Should include rollout strategy");
    assert.ok(markdown.includes("check1"), "Should include readiness checks");
    assert.ok(markdown.includes("cmd1"), "Should include recommended commands");
});
test("buildExecutionMarkdown creates correct markdown output", () => {
    const report = {
        executionId: "exec-123",
        bundleId: "bundle-456",
        generatedAt: "2026-04-26T00:00:00.000Z",
        environment: "prod",
        version: "v1.0.0",
        commitSha: "1234567",
        rolloutStrategy: "rolling",
        imageRef: "ghcr.io/img:v1",
        imageRepository: "img",
        registrySecret: {
            secretRef: "secret://test",
            envName: "TEST_SECRET",
            scope: "test",
            source: "environment",
            providerKind: "environment",
            resolved: true,
            registryStatus: "active",
            lastRotatedAt: null,
            nextRotationDueAt: null,
            auditId: null,
            maskedValue: null,
            accessMode: "lease",
            leaseId: "lease-123",
            leaseStatus: "active",
            leaseExpiresAt: "2026-04-27T00:00:00.000Z",
            revokedAt: null,
        },
        publishWorkflowRunId: "123456",
        publishWorkflowRunUrl: "https://github.com/run/123456",
        buildCommand: "docker build -t img .",
        publishCommand: "gh workflow run publish.yml",
        executionMode: "execute",
        commandResults: [
            {
                step: "build_image",
                command: "docker",
                args: ["build", "-t", "img", "."],
                executed: true,
                exitCode: 0,
                stdout: "build success",
                stderr: "",
                durationMs: 100,
            },
        ],
    };
    const markdown = buildExecutionMarkdown(report);
    assert.ok(markdown.includes("# Release Pipeline Execution Report"), "Should have title");
    assert.ok(markdown.includes("exec-123"), "Should include executionId");
    assert.ok(markdown.includes("bundle-456"), "Should include bundleId");
    assert.ok(markdown.includes("v1.0.0"), "Should include version");
    assert.ok(markdown.includes("lease-123"), "Should include lease info");
    assert.ok(markdown.includes("123456"), "Should include workflow run ID");
    assert.ok(markdown.includes("build_image"), "Should include command results");
});
//# sourceMappingURL=release-pipeline-support.test.js.map