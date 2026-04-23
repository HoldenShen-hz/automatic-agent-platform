import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ArtifactStore } from "../../state-evidence/artifacts/artifact-store.js";
import { createWorkspaceWritePolicy } from "../iam/sandbox-policy.js";
import { inspectStorageBackendConfig } from "../../state-evidence/truth/storage-backend-config.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { ReleasePipelineService } from "./release-pipeline-service.js";
import { EnvironmentDeploymentService } from "./environment-deployment-service.js";
function readJsonIfExists(path) {
    if (!existsSync(path)) {
        return null;
    }
    return JSON.parse(readFileSync(path, "utf8"));
}
function defaultCommitSha() {
    return "0123456789abcdef0123456789abcdef01234567";
}
function summarizeError(error) {
    return error instanceof Error ? error.message : String(error);
}
function summarizeLatestReleaseExecution(records) {
    const latest = records.find((record) => record.publishWorkflowRunId != null || record.publishWorkflowRunUrl != null) ?? null;
    if (latest == null) {
        return null;
    }
    return {
        executionId: latest.executionId,
        exportedAt: latest.exportedAt,
        publishWorkflowRunId: latest.publishWorkflowRunId,
        publishWorkflowRunUrl: latest.publishWorkflowRunUrl,
    };
}
function summarizeLatestDeploymentExecution(records) {
    const latest = records.find((record) => record.executionMode === "execute" && (record.deployWorkflowRunId != null || record.deployWorkflowRunUrl != null)) ?? null;
    if (latest == null) {
        return null;
    }
    return {
        executionId: latest.executionId,
        exportedAt: latest.exportedAt,
        deployWorkflowRunId: latest.deployWorkflowRunId,
        deployWorkflowRunUrl: latest.deployWorkflowRunUrl,
        executionMode: latest.executionMode,
    };
}
function buildMarkdown(report) {
    const lines = [
        "# Acceptance Readiness Report",
        "",
        `- Report ID: \`${report.reportId}\``,
        `- Generated At: \`${report.generatedAt}\``,
        `- Overall Status: \`${report.overallStatus}\``,
        `- Current Focus: \`${report.currentFocusItemId ?? "none"}\``,
        `- Source Of Truth: \`${report.sourceOfTruthPath}\``,
        "",
        "## Line Items",
        "",
    ];
    for (const item of report.lineItems) {
        lines.push(`### ${item.itemId} ${item.title}`);
        lines.push("");
        lines.push(`- Status: \`${item.status}\``);
        lines.push(`- System Prepared: \`${item.systemPrepared}\``);
        lines.push(`- Evidence Present: \`${item.evidencePresent}\``);
        lines.push(`- Summary: ${item.summary}`);
        lines.push(`- Blockers: \`${item.blockers.join(", ") || "none"}\``);
        lines.push("");
    }
    lines.push("## Recommended Next Actions", "");
    lines.push(...(report.recommendedNextActions.length > 0 ? report.recommendedNextActions.map((item) => `- ${item}`) : ["- none"]));
    return `${lines.join("\n")}\n`;
}
export class AcceptanceReadinessService {
    store;
    options;
    repoRootDir;
    evidenceRootDir;
    sourceOfTruthPath;
    artifactStore;
    runtimeEnv;
    observedStorageDriver;
    releasePipelineService;
    environmentDeploymentService;
    constructor(store, options = {}) {
        this.store = store;
        this.options = options;
        this.repoRootDir = resolve(options.repoRootDir ?? process.cwd());
        this.evidenceRootDir = resolve(options.evidenceRootDir ?? join(this.repoRootDir, "data", "stable-evidence"));
        this.sourceOfTruthPath = join(this.repoRootDir, "docs_zh", "operations", "current_todo_list.md");
        this.artifactStore = new ArtifactStore(options.artifactStoreOptions);
        this.runtimeEnv = options.runtimeEnv ?? process.env;
        this.observedStorageDriver = options.observedStorageDriver ?? null;
        this.releasePipelineService = new ReleasePipelineService({
            store,
            repoRootDir: this.repoRootDir,
            ...(options.secretManagementService == null ? {} : { secretManagementService: options.secretManagementService }),
            ...(options.artifactStoreOptions == null ? {} : { artifactStoreOptions: options.artifactStoreOptions }),
        });
        this.environmentDeploymentService = new EnvironmentDeploymentService(store, {
            repoRootDir: this.repoRootDir,
            ...(options.secretManagementService == null ? {} : { secretManagementService: options.secretManagementService }),
            ...(options.artifactStoreOptions == null ? {} : { artifactStoreOptions: options.artifactStoreOptions }),
        });
    }
    async buildReport(input = {}) {
        const generatedAt = input.generatedAt ?? nowIso();
        const targetEnvironment = input.targetEnvironment ?? "prod";
        const stableEvidence = this.buildStableEvidenceSummary();
        const postgresAuthoritativeStore = this.buildPostgresSummary(targetEnvironment);
        const registryPublish = await this.buildRegistrySummary(targetEnvironment, input);
        const multiEnvironmentDeployment = await this.buildDeploymentSummary(targetEnvironment, input);
        const lineItems = [
            stableEvidence,
            postgresAuthoritativeStore,
            registryPublish,
            multiEnvironmentDeployment,
        ];
        const currentFocus = lineItems.find((item) => item.status !== "ready") ?? null;
        const overallStatus = stableEvidence.status === "ready" && lineItems.every((item) => item.status === "ready")
            ? "ready"
            : lineItems.some((item) => item.status === "blocked")
                ? "blocked"
                : "in_progress";
        const recommendedNextActions = lineItems
            .filter((item) => item.status !== "ready")
            .flatMap((item) => item.recommendedCommands.map((command) => `${item.itemId}: ${command}`));
        return {
            reportId: newId("acceptance_readiness"),
            generatedAt,
            sourceOfTruthPath: this.sourceOfTruthPath,
            overallStatus,
            currentFocusItemId: currentFocus?.itemId ?? null,
            lineItems,
            recommendedNextActions,
            stableEvidence,
            postgresAuthoritativeStore,
            registryPublish,
            multiEnvironmentDeployment,
        };
    }
    async exportReport(input = {}) {
        const report = await this.buildReport(input);
        const taskId = input.taskId ?? "acceptance_readiness";
        const jsonArtifact = this.artifactStore.writeJsonArtifact({
            taskId,
            executionId: null,
            stepId: null,
            kind: "acceptance_readiness_report",
            fileName: `acceptance-readiness-${report.generatedAt.slice(0, 10)}.json`,
            content: report,
        }).ref;
        const markdownArtifact = this.artifactStore.writeTextArtifact({
            taskId,
            executionId: null,
            stepId: null,
            kind: "acceptance_readiness_report_markdown",
            fileName: `acceptance-readiness-${report.generatedAt.slice(0, 10)}.md`,
            content: buildMarkdown(report),
            mimeType: "text/markdown",
        }).ref;
        return {
            report,
            jsonArtifact,
            markdownArtifact,
        };
    }
    buildStableEvidenceSummary() {
        const sequenceStatePath = join(this.evidenceRootDir, "stable-evidence-sequence-state.json");
        const sequenceState = readJsonIfExists(sequenceStatePath);
        const profiles = ["24h", "72h"].map((profileName) => {
            const outputDir = join(this.evidenceRootDir, profileName);
            const campaignStatePath = join(outputDir, "stable-evidence-campaign-state.json");
            const finalEvidenceReportPath = join(outputDir, "stable-evidence-report.json");
            const profileFromSequence = sequenceState?.profiles.find((profile) => profile.profileName === profileName);
            const campaignState = readJsonIfExists(campaignStatePath);
            return {
                profileName,
                completed: profileFromSequence?.completed ?? campaignState?.completed ?? existsSync(finalEvidenceReportPath),
                passed: profileFromSequence?.passed ?? campaignState?.finalEvidencePassed ?? null,
                startedAt: profileFromSequence?.startedAt ?? campaignState?.startedAt ?? null,
                updatedAt: profileFromSequence?.updatedAt ?? campaignState?.updatedAt ?? null,
                accumulatedWallClockDurationMs: profileFromSequence?.accumulatedWallClockDurationMs
                    ?? campaignState?.accumulatedWallClockDurationMs
                    ?? 0,
                remainingWallClockDurationMs: profileFromSequence?.remainingWallClockDurationMs
                    ?? campaignState?.remainingWallClockDurationMs
                    ?? 0,
                segmentCount: profileFromSequence?.segmentCount ?? campaignState?.segments.length ?? 0,
                campaignStatePath,
                finalEvidenceReportPath,
            };
        });
        const profile24h = profiles.find((profile) => profile.profileName === "24h");
        const profile72h = profiles.find((profile) => profile.profileName === "72h");
        const sequenceCompleted = sequenceState?.completed ?? profiles.every((profile) => profile.completed && profile.passed === true);
        const sequenceBlocked = sequenceState?.blocked ?? profiles.some((profile) => profile.completed && profile.passed === false);
        const evidencePresent = profile72h.passed === true;
        const hasActivity = sequenceState != null || profiles.some((profile) => profile.completed || profile.segmentCount > 0 || profile.updatedAt != null);
        const blockers = [];
        if (profile24h.passed !== true) {
            blockers.push("stable_24h_evidence_missing_or_unpassed");
        }
        if (profile72h.passed !== true) {
            blockers.push("stable_72h_evidence_incomplete");
        }
        if (sequenceBlocked) {
            blockers.push("stable_evidence_sequence_blocked");
        }
        const status = evidencePresent
            ? "ready"
            : sequenceBlocked
                ? "blocked"
                : hasActivity
                    ? "in_progress"
                    : "blocked";
        const summary = evidencePresent
            ? "24h / 72h stable evidence completed and available for stage sign-off."
            : sequenceBlocked
                ? "Stable evidence collection blocked by failed verdict, need to fix the issue first to continue."
                : hasActivity
                    ? "72h long-duration evidence still in progress, currently still the first priority."
                    : "No available 24h / 72h stable evidence state file detected yet.";
        const recommendedCommands = evidencePresent
            ? [
                `AA_STABLE_GATE_EVIDENCE_ROOT=${this.evidenceRootDir} AA_STABLE_GATE_TARGET_STATUS=production_ready npm run gate:stable`,
            ]
            : [
                `AA_STABLE_SEQUENCE_EVIDENCE_ROOT=${this.evidenceRootDir} AA_STABLE_SEQUENCE_RUN_UNTIL_COMPLETE=true npm run sequence:stable`,
                `AA_STABLE_SEQUENCE_EVIDENCE_ROOT=${this.evidenceRootDir} npm run package:stable`,
            ];
        return {
            itemId: "P1A-EVID-72",
            title: "Stable Core 72h Long-Duration Stability Evidence",
            status,
            systemPrepared: profile24h.passed === true,
            evidencePresent,
            summary,
            blockers,
            recommendedCommands,
            evidenceRootDir: this.evidenceRootDir,
            sequenceStatePath,
            sequenceCompleted,
            sequenceBlocked,
            activeProfileName: sequenceState?.activeProfileName ?? (profile72h.completed ? null : "72h"),
            profiles,
        };
    }
    buildPostgresSummary(targetEnvironment) {
        const runtimeProfile = inspectStorageBackendConfig({
            environment: targetEnvironment,
            env: this.runtimeEnv,
            sandboxPolicy: createWorkspaceWritePolicy(this.repoRootDir),
        });
        const systemPrepared = runtimeProfile.driver === "postgres" && runtimeProfile.issues.length === 0;
        const evidencePresent = this.observedStorageDriver === "postgres" && systemPrepared;
        const status = evidencePresent
            ? "ready"
            : systemPrepared
                ? "blocked_on_external_infra"
                : "blocked";
        const blockers = evidencePresent
            ? []
            : systemPrepared
                ? ["live_postgres_validation_not_observed_in_current_runtime"]
                : [...runtimeProfile.issues];
        const summary = evidencePresent
            ? "Current runtime opened in PostgreSQL authoritative store mode, real integration prerequisites satisfied."
            : systemPrepared
                ? "PostgreSQL configuration reached integration-ready state, but no live PG runtime path observed."
                : "PostgreSQL authoritative store not yet at integration-ready configuration state.";
        return {
            itemId: "IND-P0-01",
            title: "PostgreSQL Real Environment Integration",
            status,
            systemPrepared,
            evidencePresent,
            summary,
            blockers,
            recommendedCommands: systemPrepared
                ? [
                    "After real PostgreSQL instance is available, run doctor / authoritative-storage / targeted acceptance with postgres storage profile.",
                ]
                : [
                    "Complete AA_STORAGE_DRIVER=postgres, AA_STORAGE_POSTGRES_DSN, AA_STORAGE_POSTGRES_DUAL_RUN=true, AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH configuration.",
                ],
            targetEnvironment,
            observedStorageDriver: this.observedStorageDriver,
            runtimeProfile,
        };
    }
    async buildRegistrySummary(targetEnvironment, input) {
        let configuredEnvironments = [];
        let bundleReady = false;
        const blockers = [];
        try {
            const configs = this.releasePipelineService.listEnvironmentConfigs();
            configuredEnvironments = configs.map((item) => item.environment);
            const targetConfig = configs.find((item) => item.environment === targetEnvironment) ?? null;
            if (targetConfig == null) {
                blockers.push(`release_environment_missing:${targetEnvironment}`);
            }
            else {
                await this.releasePipelineService.buildBundle({
                    environment: targetEnvironment,
                    version: input.version ?? "0.0.0-readiness",
                    commitSha: input.commitSha ?? defaultCommitSha(),
                    rolloutStrategy: input.rolloutStrategy ?? targetConfig.allowedRolloutStrategies[0] ?? "rolling",
                    generatedAt: input.generatedAt ?? nowIso(),
                });
                bundleReady = true;
            }
        }
        catch (error) {
            blockers.push(summarizeError(error));
        }
        const latestExecution = summarizeLatestReleaseExecution(this.store.release.listReleaseExecutionReportRecords({ environment: targetEnvironment, limit: 5 }));
        const evidencePresent = latestExecution != null;
        const status = evidencePresent
            ? "ready"
            : bundleReady
                ? "blocked_on_external_infra"
                : "blocked";
        const summary = evidencePresent
            ? "Registry publish / CI-CD workflow dispatch evidence exists."
            : bundleReady
                ? "Release pipeline configuration and secret baseline ready, but missing live registry publish evidence."
                : "Release pipeline still has local configuration or secret preparation gaps.";
        if (!evidencePresent && bundleReady) {
            blockers.push("live_registry_publish_evidence_missing");
        }
        return {
            itemId: "IND-P0-09",
            title: "Live Registry Publish / CI-CD Integration",
            status,
            systemPrepared: bundleReady,
            evidencePresent,
            summary,
            blockers,
            recommendedCommands: bundleReady
                ? [
                    `AA_RELEASE_ACTION=execute AA_RELEASE_ENVIRONMENT=${targetEnvironment} AA_RELEASE_VERSION=${input.version ?? "0.0.0-readiness"} AA_RELEASE_COMMIT_SHA=${input.commitSha ?? defaultCommitSha()} AA_RELEASE_ROLLOUT_STRATEGY=${input.rolloutStrategy ?? "rolling"} npm run release-pipeline`,
                ]
                : [
                    `AA_RELEASE_ACTION=build AA_RELEASE_ENVIRONMENT=${targetEnvironment} AA_RELEASE_VERSION=0.0.0-readiness AA_RELEASE_COMMIT_SHA=${defaultCommitSha()} AA_RELEASE_ROLLOUT_STRATEGY=rolling npm run release-pipeline`,
                ],
            targetEnvironment,
            configuredEnvironments,
            latestExecution,
        };
    }
    async buildDeploymentSummary(targetEnvironment, input) {
        let deploymentReport = null;
        const blockers = [];
        let effectiveRolloutStrategy = input.rolloutStrategy ?? "rolling";
        try {
            const targetConfig = this.releasePipelineService
                .listEnvironmentConfigs()
                .find((config) => config.environment === targetEnvironment);
            effectiveRolloutStrategy = input.rolloutStrategy ?? targetConfig?.allowedRolloutStrategies[0] ?? "rolling";
            deploymentReport = await this.environmentDeploymentService.buildReport({
                targetEnvironment,
                version: input.version ?? "0.0.0-readiness",
                commitSha: input.commitSha ?? defaultCommitSha(),
                rolloutStrategy: effectiveRolloutStrategy,
                generatedAt: input.generatedAt ?? nowIso(),
            });
        }
        catch (error) {
            blockers.push(summarizeError(error));
        }
        const targetEntry = deploymentReport?.entries.find((entry) => entry.environment === targetEnvironment) ?? null;
        const latestExecution = summarizeLatestDeploymentExecution(this.store.release.listDeploymentExecutionReportRecords({ environment: targetEnvironment, limit: 5 }));
        const evidencePresent = latestExecution != null;
        const systemPrepared = deploymentReport?.targetEligible ?? false;
        const status = evidencePresent
            ? "ready"
            : systemPrepared
                ? "blocked_on_external_infra"
                : "blocked";
        const summary = evidencePresent
            ? "Multi-environment deployment execution evidence exists."
            : systemPrepared
                ? "Deployment matrix and prerequisites ready, but missing real target environment execution closure."
                : "Multi-environment deployment still has system-side readiness gaps.";
        blockers.push(...(targetEntry?.blockers ?? []));
        if (!evidencePresent && systemPrepared) {
            blockers.push("live_target_environment_execution_evidence_missing");
        }
        return {
            itemId: "IND-P0-10",
            title: "Multi-Environment Real Deployment Integration",
            status,
            systemPrepared,
            evidencePresent,
            summary,
            blockers,
            recommendedCommands: systemPrepared
                ? [
                    `AA_DEPLOYMENT_ACTION=export AA_DEPLOYMENT_TARGET_ENVIRONMENT=${targetEnvironment} AA_DEPLOYMENT_VERSION=${input.version ?? "0.0.0-readiness"} AA_DEPLOYMENT_COMMIT_SHA=${input.commitSha ?? defaultCommitSha()} AA_DEPLOYMENT_ROLLOUT_STRATEGY=${effectiveRolloutStrategy} AA_DB_PATH=$AA_DB_PATH npm run environment-deployment`,
                    `AA_DEPLOYMENT_EXECUTION_ACTION=export AA_DEPLOYMENT_TARGET_ENVIRONMENT=${targetEnvironment} AA_DEPLOYMENT_VERSION=${input.version ?? "0.0.0-readiness"} AA_DEPLOYMENT_COMMIT_SHA=${input.commitSha ?? defaultCommitSha()} AA_DEPLOYMENT_ROLLOUT_STRATEGY=${effectiveRolloutStrategy} AA_DB_PATH=$AA_DB_PATH npm run deployment-execution`,
                ]
                : [
                    `AA_DEPLOYMENT_ACTION=summary AA_DEPLOYMENT_TARGET_ENVIRONMENT=${targetEnvironment} AA_DEPLOYMENT_VERSION=0.0.0-readiness AA_DEPLOYMENT_COMMIT_SHA=${defaultCommitSha()} AA_DEPLOYMENT_ROLLOUT_STRATEGY=${effectiveRolloutStrategy} AA_DB_PATH=$AA_DB_PATH npm run environment-deployment`,
                ],
            targetEnvironment,
            highestReadyEnvironment: deploymentReport?.highestReadyEnvironment ?? null,
            targetEligible: deploymentReport?.targetEligible ?? false,
            promotionPath: deploymentReport?.promotionPath ?? [],
            targetBlockers: targetEntry?.blockers ?? [],
            latestExecution,
        };
    }
}
//# sourceMappingURL=acceptance-readiness-service.js.map