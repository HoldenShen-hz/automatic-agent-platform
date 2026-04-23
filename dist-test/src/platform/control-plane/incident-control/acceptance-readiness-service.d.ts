import { type ArtifactStoreOptions } from "../../state-evidence/artifacts/artifact-store.js";
import { type StorageBackendRuntimeProfile, type StorageDriver } from "../../state-evidence/truth/storage-backend-config.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { EnvironmentName } from "../../contracts/types/domain.js";
import type { StableEvidenceProfileName } from "../../shared/stability/stable-evidence-bundle.js";
import { SecretManagementService } from "../iam/secret-management-service.js";
export type AcceptanceReadinessStatus = "ready" | "in_progress" | "blocked" | "blocked_on_external_infra";
export interface AcceptanceReadinessLineItem {
    itemId: "P1A-EVID-72" | "IND-P0-01" | "IND-P0-09" | "IND-P0-10";
    title: string;
    status: AcceptanceReadinessStatus;
    systemPrepared: boolean;
    evidencePresent: boolean;
    summary: string;
    blockers: string[];
    recommendedCommands: string[];
}
export interface AcceptanceReadinessEvidenceProfileSummary {
    profileName: StableEvidenceProfileName;
    completed: boolean;
    passed: boolean | null;
    startedAt: string | null;
    updatedAt: string | null;
    accumulatedWallClockDurationMs: number;
    remainingWallClockDurationMs: number;
    segmentCount: number;
    campaignStatePath: string;
    finalEvidenceReportPath: string;
}
export interface AcceptanceReadinessReport {
    reportId: string;
    generatedAt: string;
    sourceOfTruthPath: string;
    overallStatus: "ready" | "in_progress" | "blocked";
    currentFocusItemId: AcceptanceReadinessLineItem["itemId"] | null;
    lineItems: AcceptanceReadinessLineItem[];
    recommendedNextActions: string[];
    stableEvidence: AcceptanceReadinessLineItem & {
        evidenceRootDir: string;
        sequenceStatePath: string;
        sequenceCompleted: boolean;
        sequenceBlocked: boolean;
        activeProfileName: StableEvidenceProfileName | null;
        profiles: AcceptanceReadinessEvidenceProfileSummary[];
    };
    postgresAuthoritativeStore: AcceptanceReadinessLineItem & {
        targetEnvironment: EnvironmentName;
        observedStorageDriver: StorageDriver | null;
        runtimeProfile: StorageBackendRuntimeProfile;
    };
    registryPublish: AcceptanceReadinessLineItem & {
        targetEnvironment: EnvironmentName;
        configuredEnvironments: EnvironmentName[];
        latestExecution: {
            executionId: string;
            exportedAt: string;
            publishWorkflowRunId: string | null;
            publishWorkflowRunUrl: string | null;
        } | null;
    };
    multiEnvironmentDeployment: AcceptanceReadinessLineItem & {
        targetEnvironment: EnvironmentName;
        highestReadyEnvironment: EnvironmentName | null;
        targetEligible: boolean;
        promotionPath: EnvironmentName[];
        targetBlockers: string[];
        latestExecution: {
            executionId: string;
            exportedAt: string;
            deployWorkflowRunId: string | null;
            deployWorkflowRunUrl: string | null;
            executionMode: string;
        } | null;
    };
}
export interface AcceptanceReadinessExportResult {
    report: AcceptanceReadinessReport;
    jsonArtifact: {
        uri: string;
    };
    markdownArtifact: {
        uri: string;
    };
}
export interface AcceptanceReadinessBuildInput {
    targetEnvironment?: EnvironmentName;
    generatedAt?: string;
    taskId?: string;
    version?: string;
    commitSha?: string;
    rolloutStrategy?: "rolling" | "canary" | "blue_green";
}
export interface AcceptanceReadinessServiceOptions {
    repoRootDir?: string;
    evidenceRootDir?: string;
    artifactStoreOptions?: ArtifactStoreOptions;
    secretManagementService?: SecretManagementService;
    runtimeEnv?: NodeJS.ProcessEnv;
    observedStorageDriver?: StorageDriver | null;
}
export declare class AcceptanceReadinessService {
    private readonly store;
    private readonly options;
    private readonly repoRootDir;
    private readonly evidenceRootDir;
    private readonly sourceOfTruthPath;
    private readonly artifactStore;
    private readonly runtimeEnv;
    private readonly observedStorageDriver;
    private readonly releasePipelineService;
    private readonly environmentDeploymentService;
    constructor(store: AuthoritativeTaskStore, options?: AcceptanceReadinessServiceOptions);
    buildReport(input?: AcceptanceReadinessBuildInput): Promise<AcceptanceReadinessReport>;
    exportReport(input?: AcceptanceReadinessBuildInput): Promise<AcceptanceReadinessExportResult>;
    private buildStableEvidenceSummary;
    private buildPostgresSummary;
    private buildRegistrySummary;
    private buildDeploymentSummary;
}
