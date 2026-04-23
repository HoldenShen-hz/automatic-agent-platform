import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeVersion, sanitizeCommitSha, sanitizeRegistry, sanitizeImageRepository, sanitizeSecretRef, sanitizeConfigBundleRef, buildMarkdown, buildExecutionMarkdown, DEFAULT_REPO_ROOT, ROTATION_GUARDED_ENVIRONMENTS, } from "../../../../../src/platform/control-plane/incident-control/release-pipeline-support.js";
function isValidationErrorWithCode(err, codePrefix) {
    return err?.message?.startsWith(codePrefix) ?? false;
}
test("sanitizeVersion accepts valid semver with v prefix", () => {
    assert.equal(sanitizeVersion("v1.0.0"), "v1.0.0");
    assert.equal(sanitizeVersion("v1.2.3"), "v1.2.3");
    assert.equal(sanitizeVersion("v0.0.1"), "v0.0.1");
});
test("sanitizeVersion accepts valid semver without v prefix", () => {
    assert.equal(sanitizeVersion("1.0.0"), "v1.0.0");
    assert.equal(sanitizeVersion("1.2.3"), "v1.2.3");
});
test("sanitizeVersion accepts semver with prerelease", () => {
    assert.equal(sanitizeVersion("v1.0.0-alpha"), "v1.0.0-alpha");
    assert.equal(sanitizeVersion("v1.0.0-beta.1"), "v1.0.0-beta.1");
    assert.equal(sanitizeVersion("1.0.0-rc.1"), "v1.0.0-rc.1");
});
test("sanitizeVersion accepts semver with build metadata", () => {
    assert.equal(sanitizeVersion("v1.0.0+build.123"), "v1.0.0+build.123");
    assert.equal(sanitizeVersion("1.0.0+20130313144700"), "v1.0.0+20130313144700");
});
test("sanitizeVersion trims whitespace", () => {
    assert.equal(sanitizeVersion("  v1.0.0  "), "v1.0.0");
    assert.equal(sanitizeVersion("\tv1.0.0\t"), "v1.0.0");
});
test("sanitizeVersion throws for invalid version", () => {
    assert.throws(() => sanitizeVersion("not-a-version"), (e) => isValidationErrorWithCode(e, "release.invalid_version:"));
    assert.throws(() => sanitizeVersion("1.0"), (e) => isValidationErrorWithCode(e, "release.invalid_version:"));
    assert.throws(() => sanitizeVersion("v1"), (e) => isValidationErrorWithCode(e, "release.invalid_version:"));
    assert.throws(() => sanitizeVersion(""), (e) => isValidationErrorWithCode(e, "release.invalid_version:"));
    assert.throws(() => sanitizeVersion("1.2.3.4"), (e) => isValidationErrorWithCode(e, "release.invalid_version:"));
});
test("sanitizeCommitSha accepts 7-character SHA", () => {
    assert.equal(sanitizeCommitSha("abc1234"), "abc1234");
    assert.equal(sanitizeCommitSha("deadbee"), "deadbee");
});
test("sanitizeCommitSha accepts 40-character SHA", () => {
    assert.equal(sanitizeCommitSha("deadbeef1234567890abcdefabcdef1234567890"), "deadbeef1234567890abcdefabcdef1234567890");
});
test("sanitizeCommitSha accepts SHA in between 7-40", () => {
    assert.equal(sanitizeCommitSha("abcdef1234567"), "abcdef1234567");
    assert.equal(sanitizeCommitSha("abcd123456789012345678901234567890abcd"), "abcd123456789012345678901234567890abcd");
});
test("sanitizeCommitSha accepts uppercase SHA", () => {
    assert.equal(sanitizeCommitSha("ABCDEF1"), "abcdef1");
    assert.equal(sanitizeCommitSha("DEADbee"), "deadbee");
});
test("sanitizeCommitSha trims whitespace", () => {
    assert.equal(sanitizeCommitSha("  abc1234  "), "abc1234");
});
test("sanitizeCommitSha throws for too short SHA", () => {
    assert.throws(() => sanitizeCommitSha("abc12"), (e) => isValidationErrorWithCode(e, "release.invalid_commit_sha:"));
    assert.throws(() => sanitizeCommitSha("abc"), (e) => isValidationErrorWithCode(e, "release.invalid_commit_sha:"));
});
test("sanitizeCommitSha throws for too long SHA", () => {
    assert.throws(() => sanitizeCommitSha("abcdef123456789012345678901234567890abcd1"), (e) => isValidationErrorWithCode(e, "release.invalid_commit_sha:"));
});
test("sanitizeCommitSha throws for invalid characters", () => {
    assert.throws(() => sanitizeCommitSha("xyz1234"), (e) => isValidationErrorWithCode(e, "release.invalid_commit_sha:"));
    assert.throws(() => sanitizeCommitSha("abc123g"), (e) => isValidationErrorWithCode(e, "release.invalid_commit_sha:"));
});
test("sanitizeRegistry accepts simple registry", () => {
    assert.equal(sanitizeRegistry("docker.io"), "docker.io");
    assert.equal(sanitizeRegistry("gcr.io"), "gcr.io");
});
test("sanitizeRegistry accepts registry with path", () => {
    assert.equal(sanitizeRegistry("docker.io/library"), "docker.io/library");
    assert.equal(sanitizeRegistry("gcr.io/my-project"), "gcr.io/my-project");
});
test("sanitizeRegistry removes trailing slashes", () => {
    assert.equal(sanitizeRegistry("docker.io/"), "docker.io");
    assert.equal(sanitizeRegistry("docker.io/library/"), "docker.io/library");
});
test("sanitizeRegistry trims whitespace", () => {
    assert.equal(sanitizeRegistry("  docker.io  "), "docker.io");
});
test("sanitizeRegistry throws for invalid registry", () => {
    assert.throws(() => sanitizeRegistry(""), (err) => err?.message?.startsWith("release.invalid_registry:"));
    assert.throws(() => sanitizeRegistry("http://docker.io"), (err) => err?.message?.startsWith("release.invalid_registry:"));
    // docker.io/library/node is actually valid (registry/path format)
    // No throw expected
});
test("sanitizeImageRepository accepts valid path", () => {
    assert.equal(sanitizeImageRepository("library/node"), "library/node");
    assert.equal(sanitizeImageRepository("my-project/my-image"), "my-project/my-image");
    assert.equal(sanitizeImageRepository("a/b/c/d"), "a/b/c/d");
});
test("sanitizeImageRepository removes leading and trailing slashes", () => {
    assert.equal(sanitizeImageRepository("/library/node/"), "library/node");
    assert.equal(sanitizeImageRepository("///library///"), "library");
});
test("sanitizeImageRepository trims whitespace", () => {
    assert.equal(sanitizeImageRepository("  library/node  "), "library/node");
});
test("sanitizeImageRepository throws for invalid path", () => {
    assert.throws(() => sanitizeImageRepository(""), (e) => isValidationErrorWithCode(e, "release.invalid_image_repository:"));
    assert.throws(() => sanitizeImageRepository("library Node"), (e) => isValidationErrorWithCode(e, "release.invalid_image_repository:"));
    assert.throws(() => sanitizeImageRepository("library:node"), (e) => isValidationErrorWithCode(e, "release.invalid_image_repository:"));
});
test("sanitizeSecretRef accepts valid secret ref", () => {
    assert.equal(sanitizeSecretRef("secret://my-secret", "test.error"), "secret://my-secret");
    assert.equal(sanitizeSecretRef("secret://path/to/secret", "test.error"), "secret://path/to/secret");
});
test("sanitizeSecretRef trims whitespace", () => {
    assert.equal(sanitizeSecretRef("  secret://my-secret  ", "test.error"), "secret://my-secret");
});
test("sanitizeSecretRef throws for invalid secret ref", () => {
    assert.throws(() => sanitizeSecretRef("", "test.error"), (e) => isValidationErrorWithCode(e, "test.error:"));
    assert.throws(() => sanitizeSecretRef("my-secret", "test.error"), (e) => isValidationErrorWithCode(e, "test.error:"));
    assert.throws(() => sanitizeSecretRef("secret:/my-secret", "test.error"), (e) => isValidationErrorWithCode(e, "test.error:"));
});
test("sanitizeSecretRef includes code in error", () => {
    let caughtError = null;
    try {
        sanitizeSecretRef("invalid", "my.error.code");
    }
    catch (err) {
        caughtError = err;
    }
    assert.ok(caughtError != null, "Expected error to be thrown");
    assert.ok(caughtError instanceof Error, "Expected Error to be thrown");
    assert.ok(caughtError.message.startsWith("my.error.code:"));
});
test("sanitizeConfigBundleRef accepts valid config bundle ref", () => {
    assert.equal(sanitizeConfigBundleRef("config-bundle://my-config"), "config-bundle://my-config");
    assert.equal(sanitizeConfigBundleRef("config-bundle://path/to/config-bundle"), "config-bundle://path/to/config-bundle");
});
test("sanitizeConfigBundleRef trims whitespace", () => {
    assert.equal(sanitizeConfigBundleRef("  config-bundle://my-config  "), "config-bundle://my-config");
});
test("sanitizeConfigBundleRef throws for invalid config bundle ref", () => {
    assert.throws(() => sanitizeConfigBundleRef(""), (e) => isValidationErrorWithCode(e, "release.invalid_config_bundle_ref:"));
    assert.throws(() => sanitizeConfigBundleRef("my-config-bundle"), (e) => isValidationErrorWithCode(e, "release.invalid_config_bundle_ref:"));
    assert.throws(() => sanitizeConfigBundleRef("config-bundle:/my-config"), (e) => isValidationErrorWithCode(e, "release.invalid_config_bundle_ref:"));
});
test("ROTATION_GUARDED_ENVIRONMENTS contains staging, pre-prod, and prod", () => {
    assert.ok(ROTATION_GUARDED_ENVIRONMENTS.has("staging"));
    assert.ok(ROTATION_GUARDED_ENVIRONMENTS.has("pre-prod"));
    assert.ok(ROTATION_GUARDED_ENVIRONMENTS.has("prod"));
});
test("ROTATION_GUARDED_ENVIRONMENTS does not contain dev or test", () => {
    assert.ok(!ROTATION_GUARDED_ENVIRONMENTS.has("dev"));
    assert.ok(!ROTATION_GUARDED_ENVIRONMENTS.has("test"));
});
test("DEFAULT_REPO_ROOT is current working directory", () => {
    assert.equal(DEFAULT_REPO_ROOT, process.cwd());
});
test("buildMarkdown generates correct structure", () => {
    const bundle = {
        bundleId: "bundle_123",
        environment: "prod",
        version: "v1.0.0",
        commitSha: "abc1234",
        imageTag: "v1.0.0",
        imageRef: "docker.io/my-image:v1.0.0",
        imageRepository: "my-image",
        rolloutStrategy: "rolling",
        deploymentNamespace: "default",
        clusterName: "prod-cluster",
        configPath: "/config",
        configBundleRef: "config-bundle://my-config",
        registryCredentialRef: "secret://registry-creds",
        deploymentCredentialRef: "secret://deploy-creds",
        publishWorkflowPath: ".github/workflows/publish.yml",
        deployWorkflowPath: ".github/workflows/deploy.yml",
        requiredReadinessChecks: ["check1", "check2"],
        recommendedCommands: ["kubectl apply", "kubectl rollout status"],
        generatedAt: "2026-01-01T00:00:00.000Z",
    };
    const result = buildMarkdown(bundle);
    assert.ok(result.includes("# Release Pipeline Bundle"));
    assert.ok(result.includes("bundle_123"));
    assert.ok(result.includes("prod"));
    assert.ok(result.includes("v1.0.0"));
    assert.ok(result.includes("abc1234"));
    assert.ok(result.includes("rolling"));
    assert.ok(result.includes("check1"));
    assert.ok(result.includes("kubectl apply"));
});
test("buildExecutionMarkdown generates correct structure", () => {
    // Use type assertion since the full object structure is complex
    const report = {
        executionId: "exec_123",
        bundleId: "bundle_123",
        generatedAt: "2026-01-01T00:00:00.000Z",
        environment: "prod",
        version: "v1.0.0",
        commitSha: "abc1234",
        rolloutStrategy: "canary",
        imageRef: "docker.io/my-image:v1.0.0",
        imageRepository: "my-image",
        registrySecret: {
            secretRef: "secret://registry-creds",
            accessMode: "describe",
            leaseId: null,
            leaseStatus: null,
            leaseExpiresAt: null,
            revokedAt: null,
            providerKind: "secret_manager",
            registryStatus: "active",
            lastRotatedAt: null,
            nextRotationDueAt: null,
            auditId: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
        },
        publishWorkflowRunId: null,
        publishWorkflowRunUrl: null,
        buildCommand: "docker build",
        publishCommand: "docker push",
        executionMode: "execute",
        commandResults: [
            {
                step: "build_image",
                command: "docker build",
                args: ["."],
                executed: true,
                exitCode: 0,
                stdout: "",
                stderr: "",
                durationMs: 1000,
            },
        ],
    };
    const result = buildExecutionMarkdown(report);
    assert.ok(result.includes("# Release Pipeline Execution Report"));
    assert.ok(result.includes("exec_123"));
    assert.ok(result.includes("bundle_123"));
    assert.ok(result.includes("prod"));
    // rolloutStrategy is not included in execution markdown, only environment/version/commit
    assert.ok(result.includes("execute"));
    assert.ok(result.includes("pending"));
    assert.ok(result.includes("docker build"));
});
//# sourceMappingURL=release-pipeline-support.test.js.map