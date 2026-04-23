/**
 * AsyncPromptRepository - Async data access for prompt management tables.
 *
 * Implements §26 storage layer - missing tables: prompt_bundles, prompt_versions, prompt_ab_tests
 */
import type { AsyncSqlConnection } from "../async-sql-database.js";
export interface PromptBundleRecord {
    bundleId: string;
    name: string;
    version: string;
    domain: string;
    taskType: string;
    packId: string | null;
    systemPromptContent: string;
    userPromptContent: string | null;
    fewShotExamplesJson: string | null;
    constraintsJson: string;
    metadataJson: string;
    deprecated: number;
    createdAt: string;
    updatedAt: string;
}
export interface PromptVersionRecord {
    versionId: string;
    bundleId: string;
    version: string;
    isCurrent: number;
    trafficWeight: number;
    trafficAllocationJson: string | null;
    createdAt: string;
    deprecatedAt: string | null;
}
export interface PromptAbTestRecord {
    testId: string;
    bundleId: string;
    testName: string;
    controlVersion: string;
    treatmentVersion: string;
    trafficSplitPercent: number;
    status: string;
    startTime: string | null;
    endTime: string | null;
    metricsJson: string;
    resultsJson: string | null;
    createdAt: string;
    updatedAt: string;
}
export declare class AsyncPromptRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertPromptBundle(bundle: PromptBundleRecord): Promise<void>;
    updatePromptBundle(input: {
        bundleId: string;
        version?: string;
        domain?: string;
        taskType?: string;
        packId?: string | null;
        systemPromptContent?: string;
        userPromptContent?: string | null;
        fewShotExamplesJson?: string | null;
        constraintsJson?: string;
        metadataJson?: string;
        deprecated?: number;
        updatedAt: string;
    }): Promise<number>;
    getPromptBundle(bundleId: string): Promise<PromptBundleRecord | null>;
    getPromptBundleByNameVersion(name: string, version: string): Promise<PromptBundleRecord | null>;
    listPromptBundlesByDomain(domain: string, taskType?: string): Promise<PromptBundleRecord[]>;
    listActivePromptBundles(): Promise<PromptBundleRecord[]>;
    insertPromptVersion(version: PromptVersionRecord): Promise<void>;
    setCurrentVersion(bundleId: string, versionId: string): Promise<number>;
    getPromptVersion(versionId: string): Promise<PromptVersionRecord | null>;
    listPromptVersions(bundleId: string): Promise<PromptVersionRecord[]>;
    getCurrentVersion(bundleId: string): Promise<PromptVersionRecord | null>;
    insertPromptAbTest(test: PromptAbTestRecord): Promise<void>;
    updatePromptAbTest(input: {
        testId: string;
        status?: string;
        startTime?: string | null;
        endTime?: string | null;
        metricsJson?: string;
        resultsJson?: string | null;
        updatedAt: string;
    }): Promise<number>;
    getPromptAbTest(testId: string): Promise<PromptAbTestRecord | null>;
    listPromptAbTestsByBundle(bundleId: string): Promise<PromptAbTestRecord[]>;
    listActiveAbTests(): Promise<PromptAbTestRecord[]>;
}
