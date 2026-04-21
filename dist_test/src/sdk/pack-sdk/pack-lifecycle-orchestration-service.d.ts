import { PackPluginCompatibilityService, type LicenseTier, type PackCompatibilityReport } from "./pack-plugin-compatibility-service.js";
import { type BusinessPackManifest } from "./pack-manifest.js";
export type BusinessPackLifecycleStage = "development" | "testing" | "certified" | "published" | "running" | "deprecated" | "archived";
export type PackApiChangeType = "initial" | "compatible" | "additive" | "breaking";
export type PackRolloutStrategy = "shadow" | "canary" | "ga";
export interface PackTestReport {
    coveragePercent: number;
    mockTestsPassed: boolean;
    stagingIntegrationPassed: boolean;
    evalPassed: boolean;
    reportRef: string;
    recordedAt: string;
    verdict: "passed" | "failed";
    findings: string[];
}
export interface PackCertificationRecord {
    reviewer: string;
    certificationReportRef: string;
    selectedLicenseTier: LicenseTier;
    pluginIds: string[];
    securityReviewPassed: boolean;
    riskReviewPassed: boolean;
    certifiedAt: string;
    compatibility: PackCompatibilityReport;
    verdict: "certified" | "blocked";
    findings: string[];
}
export interface PackRolloutRecord {
    rolloutId: string;
    strategy: PackRolloutStrategy;
    owner: string;
    rolloutScope: string[];
    createdAt: string;
    activatedAt: string | null;
    status: "ready" | "active" | "blocked";
    findings: string[];
}
export interface PackDeprecationRecord {
    owner: string;
    migrationGuideRef: string;
    effectiveAt: string;
    supportWindowDays: number;
    createdAt: string;
    status: "scheduled" | "active";
}
export interface PackLifecycleRecord {
    packId: string;
    version: string;
    owner: string;
    manifest: BusinessPackManifest;
    lifecycleStage: BusinessPackLifecycleStage;
    createdAt: string;
    updatedAt: string;
    evalDatasetIds: string[];
    apiChange: {
        changeType: PackApiChangeType;
        previousVersion: string | null;
        addedCapabilities: string[];
        removedCapabilities: string[];
        addedContracts: string[];
        removedContracts: string[];
        requiresDeprecationWarnings: boolean;
        deprecationWarningsSatisfied: boolean;
    };
    testing: PackTestReport | null;
    certification: PackCertificationRecord | null;
    rollout: PackRolloutRecord | null;
    deprecation: PackDeprecationRecord | null;
    findings: string[];
}
export interface RegisterBusinessPackInput {
    manifest: BusinessPackManifest;
    owner: string;
    evalDatasetIds?: readonly string[] | undefined;
    previousManifest?: BusinessPackManifest | null | undefined;
    declaredDeprecationWarnings?: number | undefined;
    createdAt?: string | undefined;
}
export interface RecordPackTestingInput {
    packId: string;
    version: string;
    coveragePercent: number;
    mockTestsPassed: boolean;
    stagingIntegrationPassed: boolean;
    evalPassed: boolean;
    reportRef: string;
    recordedAt?: string | undefined;
}
export interface CertifyBusinessPackInput {
    packId: string;
    version: string;
    reviewer: string;
    certificationReportRef: string;
    selectedLicenseTier: LicenseTier;
    pluginIds?: readonly string[] | undefined;
    securityReviewPassed: boolean;
    riskReviewPassed: boolean;
    certifiedAt?: string | undefined;
}
export interface PublishBusinessPackInput {
    packId: string;
    version: string;
    strategy: PackRolloutStrategy;
    owner: string;
    rolloutScope?: readonly string[] | undefined;
    autoActivate?: boolean | undefined;
    publishedAt?: string | undefined;
}
export interface DeprecateBusinessPackInput {
    packId: string;
    version: string;
    owner: string;
    migrationGuideRef: string;
    effectiveAt: string;
    supportWindowDays: number;
    deprecatedAt?: string | undefined;
}
export declare class PackLifecycleOrchestrationService {
    private readonly compatibility;
    private readonly records;
    constructor(compatibility?: PackPluginCompatibilityService);
    registerPack(input: RegisterBusinessPackInput): PackLifecycleRecord;
    recordTesting(input: RecordPackTestingInput): PackLifecycleRecord;
    certifyPack(input: CertifyBusinessPackInput): PackLifecycleRecord;
    publishPack(input: PublishBusinessPackInput): PackLifecycleRecord;
    deprecatePack(input: DeprecateBusinessPackInput): PackLifecycleRecord;
    archivePack(packId: string, version: string): PackLifecycleRecord;
    getPack(packId: string, version: string): PackLifecycleRecord | null;
    listPacks(): PackLifecycleRecord[];
    private getMutableRecord;
}
