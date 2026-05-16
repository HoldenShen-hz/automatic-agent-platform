/**
 * Prompt Bundle Repository
 *
 * Data access layer for prompt management tables.
 * Part of §26 storage layer implementation.
 */

import { newId, nowIso } from "../sqlite-repository-contracts.js";

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
export class InMemoryPromptBundleRepository implements PromptBundleRepository {
  private readonly bundles = new Map<string, PromptBundleRecord>();

  public async create(input: CreateBundleInput): Promise<PromptBundleRecord> {
    const bundleId = newId("prompt_bundle");
    const now = nowIso();

    const bundle: PromptBundleRecord = {
      bundleId,
      name: input.name,
      version: input.version,
      domain: input.domain,
      taskType: input.taskType,
      packId: input.packId ?? null,
      systemPromptContent: input.systemPromptContent,
      userPromptContent: input.userPromptContent ?? null,
      fewShotExamplesJson: input.fewShotExamples ? JSON.stringify(input.fewShotExamples) : null,
      constraintsJson: JSON.stringify(input.constraints),
      metadataJson: JSON.stringify(input.metadata ?? {}),
      deprecated: false,
      createdAt: now,
      updatedAt: now,
    };

    this.bundles.set(bundleId, bundle);
    return bundle;
  }

  public async findById(bundleId: string): Promise<PromptBundleRecord | null> {
    return this.bundles.get(bundleId) ?? null;
  }

  public async findByNameVersion(name: string, version: string): Promise<PromptBundleRecord | null> {
    return [...this.bundles.values()].find(
      (b) => b.name === name && b.version === version,
    ) ?? null;
  }

  public async findByDomainTask(domain: string, taskType: string): Promise<PromptBundleRecord[]> {
    return [...this.bundles.values()].filter(
      (b) => b.domain === domain && b.taskType === taskType && !b.deprecated,
    );
  }

  public async update(bundleId: string, input: UpdateBundleInput): Promise<PromptBundleRecord> {
    const existing = this.bundles.get(bundleId);
    if (!existing) {
      throw new Error(`Bundle ${bundleId} not found`);
    }

    const updated: PromptBundleRecord = {
      ...existing,
      systemPromptContent: input.systemPromptContent ?? existing.systemPromptContent,
      userPromptContent: input.userPromptContent ?? existing.userPromptContent,
      fewShotExamplesJson: input.fewShotExamples
        ? JSON.stringify(input.fewShotExamples)
        : existing.fewShotExamplesJson,
      constraintsJson: input.constraints ? JSON.stringify(input.constraints) : existing.constraintsJson,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : existing.metadataJson,
      updatedAt: nowIso(),
    };

    this.bundles.set(bundleId, updated);
    return updated;
  }

  public async deprecate(bundleId: string): Promise<void> {
    const existing = this.bundles.get(bundleId);
    if (existing) {
      existing.deprecated = true;
      existing.updatedAt = nowIso();
    }
  }

  public async delete(bundleId: string): Promise<void> {
    this.bundles.delete(bundleId);
  }

  public async listAll(limit: number, offset: number): Promise<PromptBundleRecord[]> {
    return [...this.bundles.values()].slice(offset, offset + limit);
  }
}

/**
 * In-memory implementation of PromptVersionRepository.
 */
export class InMemoryPromptVersionRepository implements PromptVersionRepository {
  private readonly versions = new Map<string, PromptVersionRecord[]>();

  public async create(input: CreateVersionInput): Promise<PromptVersionRecord> {
    const versionId = newId("prompt_version");
    const now = nowIso();

    const record: PromptVersionRecord = {
      versionId,
      bundleId: input.bundleId,
      version: input.version,
      isCurrent: input.isCurrent ?? false,
      trafficWeight: input.trafficWeight ?? 100,
      trafficAllocationJson: input.trafficAllocation ? JSON.stringify(input.trafficAllocation) : null,
      createdAt: now,
      deprecatedAt: null,
    };

    const existing = this.versions.get(input.bundleId) ?? [];
    existing.push(record);
    this.versions.set(input.bundleId, existing);

    return record;
  }

  public async findByBundleId(bundleId: string): Promise<PromptVersionRecord[]> {
    return this.versions.get(bundleId) ?? [];
  }

  public async findCurrentByBundleId(bundleId: string): Promise<PromptVersionRecord | null> {
    return this.versions.get(bundleId)?.find((v) => v.isCurrent) ?? null;
  }

  public async setCurrent(bundleId: string, version: string): Promise<void> {
    const existing = this.versions.get(bundleId);
    if (existing) {
      for (const v of existing) {
        v.isCurrent = v.version === version;
      }
    }
  }

  public async deprecate(bundleId: string, version: string): Promise<void> {
    const existing = this.versions.get(bundleId);
    if (existing) {
      const record = existing.find((v) => v.version === version);
      if (record) {
        record.deprecatedAt = nowIso();
      }
    }
  }
}

/**
 * In-memory implementation of PromptAbTestRepository.
 */
export class InMemoryPromptAbTestRepository implements PromptAbTestRepository {
  private readonly tests = new Map<string, PromptAbTestRecord>();

  public async create(input: CreateTestInput): Promise<PromptAbTestRecord> {
    const testId = newId("prompt_ab_test");
    const now = nowIso();

    const record: PromptAbTestRecord = {
      testId,
      bundleId: input.bundleId,
      testName: input.testName,
      controlVersion: input.controlVersion,
      treatmentVersion: input.treatmentVersion,
      trafficSplitPercent: input.trafficSplitPercent ?? 50,
      status: "draft",
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      metricsJson: JSON.stringify(input.metrics),
      resultsJson: null,
      createdAt: now,
      updatedAt: now,
    };

    this.tests.set(testId, record);
    return record;
  }

  public async findById(testId: string): Promise<PromptAbTestRecord | null> {
    return this.tests.get(testId) ?? null;
  }

  public async findByBundleId(bundleId: string): Promise<PromptAbTestRecord[]> {
    return [...this.tests.values()].filter((t) => t.bundleId === bundleId);
  }

  public async findByStatus(status: PromptAbTestRecord["status"]): Promise<PromptAbTestRecord[]> {
    return [...this.tests.values()].filter((t) => t.status === status);
  }

  public async updateResults(testId: string, results: unknown): Promise<void> {
    const existing = this.tests.get(testId);
    if (existing) {
      existing.resultsJson = JSON.stringify(results);
      existing.updatedAt = nowIso();
    }
  }

  public async updateStatus(testId: string, status: PromptAbTestRecord["status"]): Promise<void> {
    const existing = this.tests.get(testId);
    if (existing) {
      existing.status = status;
      existing.updatedAt = nowIso();
    }
  }

  public async delete(testId: string): Promise<void> {
    this.tests.delete(testId);
  }
}
