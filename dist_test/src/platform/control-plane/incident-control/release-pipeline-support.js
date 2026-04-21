/**
 * Release Pipeline Service
 *
 * Manages the build, publish, and deploy lifecycle for releases across environments.
 * Constructs release bundles that combine version metadata, configuration, and secrets
 * into a deployable unit. Supports rolling, canary, and blue-green deployment strategies.
 *
 * The service handles environment promotion from dev through test, staging, pre-prod,
 * and finally to production, ensuring each environment meets readiness requirements
 * before allowing promotion to the next.
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/architecture_governance_and_versioning_contract.md | Architecture Governance Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { ValidationError } from "../../contracts/errors.js";
export { extractWorkflowDispatchReceipt } from "./workflow-dispatch-receipt.js";
export const DEFAULT_REPO_ROOT = process.cwd();
export const DEFAULT_CONFIG_ROOT = join(DEFAULT_REPO_ROOT, "config", "environments");
// Environments where secret rotation must be completed before deployment
export const ROTATION_GUARDED_ENVIRONMENTS = new Set(["staging", "pre-prod", "prod"]);
/**
 * Default command runner that executes commands locally via spawnSync.
 * Captures stdout/stderr and timing information for reporting.
 */
export class LocalReleasePipelineCommandRunner {
    run(request) {
        const startedAt = Date.now();
        const result = spawnSync(request.command, request.args, {
            cwd: request.cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
        return {
            step: request.step,
            command: request.command,
            args: [...request.args],
            executed: true,
            exitCode: result.status ?? 1,
            stdout: result.stdout ?? "",
            stderr: result.stderr ?? "",
            durationMs: Date.now() - startedAt,
        };
    }
}
/**
 * Validates and normalizes a semantic version string.
 * Accepts versions with or without 'v' prefix.
 * Throws ValidationError if the version format is invalid.
 */
export function sanitizeVersion(version) {
    const normalized = version.trim();
    if (!/^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(normalized)) {
        const code = `release.invalid_version:${version}`;
        throw new ValidationError(code, code, {
            retryable: false,
            details: { version },
        });
    }
    return normalized.startsWith("v") ? normalized : `v${normalized}`;
}
/**
 * Validates and normalizes a git commit SHA.
 * Must be 7-40 hex characters.
 */
export function sanitizeCommitSha(commitSha) {
    const normalized = commitSha.trim();
    if (!/^[a-f0-9]{7,40}$/i.test(normalized)) {
        const code = `release.invalid_commit_sha:${commitSha}`;
        throw new ValidationError(code, code, {
            retryable: false,
            details: { commitSha },
        });
    }
    return normalized.toLowerCase();
}
/**
 * Validates and normalizes a container registry URL.
 */
export function sanitizeRegistry(registry) {
    const normalized = registry.trim().replace(/\/+$/, "");
    if (!/^[a-z0-9.-]+(?:\/[a-z0-9._/-]+)?$/i.test(normalized)) {
        const code = `release.invalid_registry:${registry}`;
        throw new ValidationError(code, code, {
            retryable: false,
            details: { registry },
        });
    }
    return normalized;
}
/**
 * Validates and normalizes an image repository path.
 */
export function sanitizeImageRepository(imageRepository) {
    const normalized = imageRepository.trim().replace(/^\/+/, "").replace(/\/+$/, "");
    if (!/^[a-z0-9._/-]+$/i.test(normalized)) {
        const code = `release.invalid_image_repository:${imageRepository}`;
        throw new ValidationError(code, code, {
            retryable: false,
            details: { imageRepository },
        });
    }
    return normalized;
}
/**
 * Validates a secret reference URI format.
 */
export function sanitizeSecretRef(secretRef, code) {
    const normalized = secretRef.trim();
    if (!/^secret:\/\/[a-z0-9._/-]+$/i.test(normalized)) {
        const detailedCode = `${code}:${secretRef}`;
        throw new ValidationError(detailedCode, detailedCode, {
            retryable: false,
            details: { secretRef },
        });
    }
    return normalized;
}
/**
 * Validates a config bundle reference URI format.
 */
export function sanitizeConfigBundleRef(configBundleRef) {
    const normalized = configBundleRef.trim();
    if (!/^config-bundle:\/\/[a-z0-9._/-]+$/i.test(normalized)) {
        const code = `release.invalid_config_bundle_ref:${configBundleRef}`;
        throw new ValidationError(code, code, {
            retryable: false,
            details: { configBundleRef },
        });
    }
    return normalized;
}
/**
 * Builds a markdown representation of a release bundle for human review.
 */
export function buildMarkdown(bundle) {
    return [
        "# Release Pipeline Bundle",
        "",
        `- Bundle ID: \`${bundle.bundleId}\``,
        `- Environment: \`${bundle.environment}\``,
        `- Version: \`${bundle.version}\``,
        `- Commit SHA: \`${bundle.commitSha}\``,
        `- Image Ref: \`${bundle.imageRef}\``,
        `- Rollout Strategy: \`${bundle.rolloutStrategy}\``,
        `- Cluster: \`${bundle.clusterName}\``,
        `- Namespace: \`${bundle.deploymentNamespace}\``,
        `- Config Path: \`${bundle.configPath}\``,
        "",
        "## Required Readiness Checks",
        "",
        ...bundle.requiredReadinessChecks.map((item) => `- \`${item}\``),
        "",
        "## Recommended Commands",
        "",
        ...bundle.recommendedCommands.map((item) => `- \`${item}\``),
    ].join("\n");
}
/**
 * Builds a markdown representation of a release pipeline execution report.
 */
export function buildExecutionMarkdown(report) {
    return [
        "# Release Pipeline Execution Report",
        "",
        `- Execution ID: \`${report.executionId}\``,
        `- Bundle ID: \`${report.bundleId}\``,
        `- Environment: \`${report.environment}\``,
        `- Version: \`${report.version}\``,
        `- Commit SHA: \`${report.commitSha}\``,
        `- Image Ref: \`${report.imageRef}\``,
        `- Execution Mode: \`${report.executionMode}\``,
        `- Registry Secret Ref: \`${report.registrySecret.secretRef}\``,
        `- Registry Secret Access: \`${report.registrySecret.accessMode}\`${report.registrySecret.leaseId == null ? "" : ` lease=\`${report.registrySecret.leaseId}\``}`,
        `- Publish Workflow Run: \`${report.publishWorkflowRunId ?? "pending"}\`${report.publishWorkflowRunUrl == null ? "" : ` url=\`${report.publishWorkflowRunUrl}\``}`,
        "",
        "## Commands",
        "",
        `- Build: \`${report.buildCommand}\``,
        `- Publish: \`${report.publishCommand}\``,
        "",
        "## Command Results",
        "",
        ...report.commandResults.map((result) => `- \`${result.step}\`: exit=${result.exitCode}, executed=${result.executed}, durationMs=${result.durationMs}`),
    ].join("\n");
}
/**
 * ReleasePipelineService manages the build, publish, and deploy lifecycle.
 * It constructs release bundles with validated metadata, manages secret leases,
 * and executes GitHub Actions workflows for CI/CD integration.
 */
//# sourceMappingURL=release-pipeline-support.js.map