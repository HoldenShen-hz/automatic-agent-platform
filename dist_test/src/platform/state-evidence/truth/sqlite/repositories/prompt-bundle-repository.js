/**
 * Prompt Bundle Repository
 *
 * Data access layer for prompt management tables.
 * Part of §26 storage layer implementation.
 */
import { newId, nowIso } from "../../../../contracts/types/ids.js";
/**
 * In-memory implementation of PromptBundleRepository.
 */
export class InMemoryPromptBundleRepository {
    bundles = new Map();
    async create(input) {
        const bundleId = newId("prompt_bundle");
        const now = nowIso();
        const bundle = {
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
    async findById(bundleId) {
        return this.bundles.get(bundleId) ?? null;
    }
    async findByNameVersion(name, version) {
        return [...this.bundles.values()].find((b) => b.name === name && b.version === version) ?? null;
    }
    async findByDomainTask(domain, taskType) {
        return [...this.bundles.values()].filter((b) => b.domain === domain && b.taskType === taskType && !b.deprecated);
    }
    async update(bundleId, input) {
        const existing = this.bundles.get(bundleId);
        if (!existing) {
            throw new Error(`Bundle ${bundleId} not found`);
        }
        const updated = {
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
    async deprecate(bundleId) {
        const existing = this.bundles.get(bundleId);
        if (existing) {
            existing.deprecated = true;
            existing.updatedAt = nowIso();
        }
    }
    async delete(bundleId) {
        this.bundles.delete(bundleId);
    }
    async listAll(limit, offset) {
        return [...this.bundles.values()].slice(offset, offset + limit);
    }
}
/**
 * In-memory implementation of PromptVersionRepository.
 */
export class InMemoryPromptVersionRepository {
    versions = new Map();
    async create(input) {
        const versionId = newId("prompt_version");
        const now = nowIso();
        const record = {
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
    async findByBundleId(bundleId) {
        return this.versions.get(bundleId) ?? [];
    }
    async findCurrentByBundleId(bundleId) {
        return this.versions.get(bundleId)?.find((v) => v.isCurrent) ?? null;
    }
    async setCurrent(bundleId, version) {
        const existing = this.versions.get(bundleId);
        if (existing) {
            for (const v of existing) {
                v.isCurrent = v.version === version;
            }
        }
    }
    async deprecate(bundleId, version) {
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
export class InMemoryPromptAbTestRepository {
    tests = new Map();
    async create(input) {
        const testId = newId("prompt_ab_test");
        const now = nowIso();
        const record = {
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
    async findById(testId) {
        return this.tests.get(testId) ?? null;
    }
    async findByBundleId(bundleId) {
        return [...this.tests.values()].filter((t) => t.bundleId === bundleId);
    }
    async findByStatus(status) {
        return [...this.tests.values()].filter((t) => t.status === status);
    }
    async updateResults(testId, results) {
        const existing = this.tests.get(testId);
        if (existing) {
            existing.resultsJson = JSON.stringify(results);
            existing.updatedAt = nowIso();
        }
    }
    async updateStatus(testId, status) {
        const existing = this.tests.get(testId);
        if (existing) {
            existing.status = status;
            existing.updatedAt = nowIso();
        }
    }
    async delete(testId) {
        this.tests.delete(testId);
    }
}
//# sourceMappingURL=prompt-bundle-repository.js.map