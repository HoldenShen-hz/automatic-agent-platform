/**
 * Prompt Bundle Repository
 *
 * Data access layer for prompt management tables.
 * Part of §26 storage layer implementation.
 */
export type PromptBundleStatus = "draft" | "active" | "deprecated";
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
    deprecated: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface PromptVersionRecord {
    versionId: string;
    bundleId: string;
    version: string;
    isCurrent: boolean;
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
    status: "draft" | "running" | "completed" | "cancelled";
    startTime: string | null;
    endTime: string | null;
    metricsJson: string;
    resultsJson: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface PromptBundleRepository {
    create(input: CreateBundleInput): Promise<PromptBundleRecord>;
    findById(bundleId: string): Promise<PromptBundleRecord | null>;
    findByNameVersion(name: string, version: string): Promise<PromptBundleRecord | null>;
    findByDomainTask(domain: string, taskType: string): Promise<PromptBundleRecord[]>;
    update(bundleId: string, input: UpdateBundleInput): Promise<PromptBundleRecord>;
    deprecate(bundleId: string): Promise<void>;
    delete(bundleId: string): Promise<void>;
    listAll(limit: number, offset: number): Promise<PromptBundleRecord[]>;
}
export interface CreateBundleInput {
    name: string;
    version: string;
    domain: string;
    taskType: string;
    packId?: string;
    systemPromptContent: string;
    userPromptContent?: string;
    fewShotExamples?: unknown[];
    constraints: PromptBundleConstraints;
    metadata?: PromptBundleMetadata;
}
export interface UpdateBundleInput {
    systemPromptContent?: string;
    userPromptContent?: string;
    fewShotExamples?: unknown[];
    constraints?: PromptBundleConstraints;
    metadata?: PromptBundleMetadata;
}
export interface PromptBundleConstraints {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
    responseFormat?: "text" | "json" | "xml" | "markdown";
    customConstraints?: Record<string, unknown>;
}
export interface PromptBundleMetadata {
    owner?: string;
    tags?: string[];
    compatibilityTags?: string[];
    trafficAllocation?: {
        weight: number;
        startTime?: string;
        endTime?: string;
    };
}
export interface PromptVersionRepository {
    create(input: CreateVersionInput): Promise<PromptVersionRecord>;
    findByBundleId(bundleId: string): Promise<PromptVersionRecord[]>;
    findCurrentByBundleId(bundleId: string): Promise<PromptVersionRecord | null>;
    setCurrent(bundleId: string, version: string): Promise<void>;
    deprecate(bundleId: string, version: string): Promise<void>;
}
export interface CreateVersionInput {
    bundleId: string;
    version: string;
    isCurrent?: boolean;
    trafficWeight?: number;
    trafficAllocation?: unknown;
}
export interface PromptAbTestRepository {
    create(input: CreateTestInput): Promise<PromptAbTestRecord>;
    findById(testId: string): Promise<PromptAbTestRecord | null>;
    findByBundleId(bundleId: string): Promise<PromptAbTestRecord[]>;
    findByStatus(status: PromptAbTestRecord["status"]): Promise<PromptAbTestRecord[]>;
    updateResults(testId: string, results: unknown): Promise<void>;
    updateStatus(testId: string, status: PromptAbTestRecord["status"]): Promise<void>;
    delete(testId: string): Promise<void>;
}
export interface CreateTestInput {
    bundleId: string;
    testName: string;
    controlVersion: string;
    treatmentVersion: string;
    trafficSplitPercent?: number;
    startTime?: string;
    endTime?: string;
    metrics: unknown;
}
/**
 * In-memory implementation of PromptBundleRepository.
 */
export declare class InMemoryPromptBundleRepository implements PromptBundleRepository {
    private readonly bundles;
    create(input: CreateBundleInput): Promise<PromptBundleRecord>;
    findById(bundleId: string): Promise<PromptBundleRecord | null>;
    findByNameVersion(name: string, version: string): Promise<PromptBundleRecord | null>;
    findByDomainTask(domain: string, taskType: string): Promise<PromptBundleRecord[]>;
    update(bundleId: string, input: UpdateBundleInput): Promise<PromptBundleRecord>;
    deprecate(bundleId: string): Promise<void>;
    delete(bundleId: string): Promise<void>;
    listAll(limit: number, offset: number): Promise<PromptBundleRecord[]>;
}
/**
 * In-memory implementation of PromptVersionRepository.
 */
export declare class InMemoryPromptVersionRepository implements PromptVersionRepository {
    private readonly versions;
    create(input: CreateVersionInput): Promise<PromptVersionRecord>;
    findByBundleId(bundleId: string): Promise<PromptVersionRecord[]>;
    findCurrentByBundleId(bundleId: string): Promise<PromptVersionRecord | null>;
    setCurrent(bundleId: string, version: string): Promise<void>;
    deprecate(bundleId: string, version: string): Promise<void>;
}
/**
 * In-memory implementation of PromptAbTestRepository.
 */
export declare class InMemoryPromptAbTestRepository implements PromptAbTestRepository {
    private readonly tests;
    create(input: CreateTestInput): Promise<PromptAbTestRecord>;
    findById(testId: string): Promise<PromptAbTestRecord | null>;
    findByBundleId(bundleId: string): Promise<PromptAbTestRecord[]>;
    findByStatus(status: PromptAbTestRecord["status"]): Promise<PromptAbTestRecord[]>;
    updateResults(testId: string, results: unknown): Promise<void>;
    updateStatus(testId: string, status: PromptAbTestRecord["status"]): Promise<void>;
    delete(testId: string): Promise<void>;
}
