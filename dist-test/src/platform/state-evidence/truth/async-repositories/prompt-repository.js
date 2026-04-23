/**
 * AsyncPromptRepository - Async data access for prompt management tables.
 *
 * Implements §26 storage layer - missing tables: prompt_bundles, prompt_versions, prompt_ab_tests
 */
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
export class AsyncPromptRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    // ================================
    // PROMPT BUNDLES
    // ================================
    async insertPromptBundle(bundle) {
        await this.conn.execute(`INSERT INTO prompt_bundles (
        bundle_id, name, version, domain, task_type, pack_id,
        system_prompt_content, user_prompt_content, few_shot_examples_json,
        constraints_json, metadata_json, deprecated, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`, bundle.bundleId, bundle.name, bundle.version, bundle.domain, bundle.taskType, bundle.packId, bundle.systemPromptContent, bundle.userPromptContent, bundle.fewShotExamplesJson, bundle.constraintsJson, bundle.metadataJson, bundle.deprecated, bundle.createdAt, bundle.updatedAt);
    }
    async updatePromptBundle(input) {
        const sets = ["updated_at = $1"];
        const values = [input.updatedAt];
        let idx = 2;
        if (input.version !== undefined) {
            sets.push(`version = $${idx++}`);
            values.push(input.version);
        }
        if (input.domain !== undefined) {
            sets.push(`domain = $${idx++}`);
            values.push(input.domain);
        }
        if (input.taskType !== undefined) {
            sets.push(`task_type = $${idx++}`);
            values.push(input.taskType);
        }
        if (input.packId !== undefined) {
            sets.push(`pack_id = $${idx++}`);
            values.push(input.packId);
        }
        if (input.systemPromptContent !== undefined) {
            sets.push(`system_prompt_content = $${idx++}`);
            values.push(input.systemPromptContent);
        }
        if (input.userPromptContent !== undefined) {
            sets.push(`user_prompt_content = $${idx++}`);
            values.push(input.userPromptContent);
        }
        if (input.fewShotExamplesJson !== undefined) {
            sets.push(`few_shot_examples_json = $${idx++}`);
            values.push(input.fewShotExamplesJson);
        }
        if (input.constraintsJson !== undefined) {
            sets.push(`constraints_json = $${idx++}`);
            values.push(input.constraintsJson);
        }
        if (input.metadataJson !== undefined) {
            sets.push(`metadata_json = $${idx++}`);
            values.push(input.metadataJson);
        }
        if (input.deprecated !== undefined) {
            sets.push(`deprecated = $${idx++}`);
            values.push(input.deprecated);
        }
        values.push(input.bundleId);
        return asyncExecute(this.conn, `UPDATE prompt_bundles SET ${sets.join(", ")} WHERE bundle_id = $${idx}`, ...values);
    }
    async getPromptBundle(bundleId) {
        const result = await asyncQueryOne(this.conn, `SELECT
        bundle_id AS "bundleId",
        name,
        version,
        domain,
        task_type AS "taskType",
        pack_id AS "packId",
        system_prompt_content AS "systemPromptContent",
        user_prompt_content AS "userPromptContent",
        few_shot_examples_json AS "fewShotExamplesJson",
        constraints_json AS "constraintsJson",
        metadata_json AS "metadataJson",
        deprecated,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM prompt_bundles WHERE bundle_id = $1`, bundleId);
        return result ?? null;
    }
    async getPromptBundleByNameVersion(name, version) {
        const result = await asyncQueryOne(this.conn, `SELECT
        bundle_id AS "bundleId",
        name,
        version,
        domain,
        task_type AS "taskType",
        pack_id AS "packId",
        system_prompt_content AS "systemPromptContent",
        user_prompt_content AS "userPromptContent",
        few_shot_examples_json AS "fewShotExamplesJson",
        constraints_json AS "constraintsJson",
        metadata_json AS "metadataJson",
        deprecated,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM prompt_bundles WHERE name = $1 AND version = $2`, name, version);
        return result ?? null;
    }
    async listPromptBundlesByDomain(domain, taskType) {
        if (taskType) {
            return asyncQueryAll(this.conn, `SELECT
          bundle_id AS "bundleId",
          name,
          version,
          domain,
          task_type AS "taskType",
          pack_id AS "packId",
          system_prompt_content AS "systemPromptContent",
          user_prompt_content AS "userPromptContent",
          few_shot_examples_json AS "fewShotExamplesJson",
          constraints_json AS "constraintsJson",
          metadata_json AS "metadataJson",
          deprecated,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
         FROM prompt_bundles
         WHERE domain = $1 AND task_type = $2 AND deprecated = 0
         ORDER BY created_at DESC`, domain, taskType);
        }
        return asyncQueryAll(this.conn, `SELECT
        bundle_id AS "bundleId",
        name,
        version,
        domain,
        task_type AS "taskType",
        pack_id AS "packId",
        system_prompt_content AS "systemPromptContent",
        user_prompt_content AS "userPromptContent",
        few_shot_examples_json AS "fewShotExamplesJson",
        constraints_json AS "constraintsJson",
        metadata_json AS "metadataJson",
        deprecated,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM prompt_bundles
       WHERE domain = $1 AND deprecated = 0
       ORDER BY created_at DESC`, domain);
    }
    async listActivePromptBundles() {
        return asyncQueryAll(this.conn, `SELECT
        bundle_id AS "bundleId",
        name,
        version,
        domain,
        task_type AS "taskType",
        pack_id AS "packId",
        system_prompt_content AS "systemPromptContent",
        user_prompt_content AS "userPromptContent",
        few_shot_examples_json AS "fewShotExamplesJson",
        constraints_json AS "constraintsJson",
        metadata_json AS "metadataJson",
        deprecated,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM prompt_bundles
       WHERE deprecated = 0
       ORDER BY domain, task_type, name`);
    }
    // ================================
    // PROMPT VERSIONS
    // ================================
    async insertPromptVersion(version) {
        await this.conn.execute(`INSERT INTO prompt_versions (
        version_id, bundle_id, version, is_current, traffic_weight,
        traffic_allocation_json, created_at, deprecated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, version.versionId, version.bundleId, version.version, version.isCurrent, version.trafficWeight, version.trafficAllocationJson, version.createdAt, version.deprecatedAt);
    }
    async setCurrentVersion(bundleId, versionId) {
        await asyncExecute(this.conn, `UPDATE prompt_versions SET is_current = 0 WHERE bundle_id = $1`, bundleId);
        return asyncExecute(this.conn, `UPDATE prompt_versions SET is_current = 1 WHERE version_id = $1`, versionId);
    }
    async getPromptVersion(versionId) {
        const result = await asyncQueryOne(this.conn, `SELECT
        version_id AS "versionId",
        bundle_id AS "bundleId",
        version,
        is_current AS "isCurrent",
        traffic_weight AS "trafficWeight",
        traffic_allocation_json AS "trafficAllocationJson",
        created_at AS "createdAt",
        deprecated_at AS "deprecatedAt"
       FROM prompt_versions WHERE version_id = $1`, versionId);
        return result ?? null;
    }
    async listPromptVersions(bundleId) {
        return asyncQueryAll(this.conn, `SELECT
        version_id AS "versionId",
        bundle_id AS "bundleId",
        version,
        is_current AS "isCurrent",
        traffic_weight AS "trafficWeight",
        traffic_allocation_json AS "trafficAllocationJson",
        created_at AS "createdAt",
        deprecated_at AS "deprecatedAt"
       FROM prompt_versions
       WHERE bundle_id = $1
       ORDER BY created_at DESC`, bundleId);
    }
    async getCurrentVersion(bundleId) {
        const result = await asyncQueryOne(this.conn, `SELECT
        version_id AS "versionId",
        bundle_id AS "bundleId",
        version,
        is_current AS "isCurrent",
        traffic_weight AS "trafficWeight",
        traffic_allocation_json AS "trafficAllocationJson",
        created_at AS "createdAt",
        deprecated_at AS "deprecatedAt"
       FROM prompt_versions
       WHERE bundle_id = $1 AND is_current = 1`, bundleId);
        return result ?? null;
    }
    // ================================
    // PROMPT AB TESTS
    // ================================
    async insertPromptAbTest(test) {
        await this.conn.execute(`INSERT INTO prompt_ab_tests (
        test_id, bundle_id, test_name, control_version, treatment_version,
        traffic_split_percent, status, start_time, end_time, metrics_json,
        results_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, test.testId, test.bundleId, test.testName, test.controlVersion, test.treatmentVersion, test.trafficSplitPercent, test.status, test.startTime, test.endTime, test.metricsJson, test.resultsJson, test.createdAt, test.updatedAt);
    }
    async updatePromptAbTest(input) {
        const sets = ["updated_at = $1"];
        const values = [input.updatedAt];
        let idx = 2;
        if (input.status !== undefined) {
            sets.push(`status = $${idx++}`);
            values.push(input.status);
        }
        if (input.startTime !== undefined) {
            sets.push(`start_time = $${idx++}`);
            values.push(input.startTime);
        }
        if (input.endTime !== undefined) {
            sets.push(`end_time = $${idx++}`);
            values.push(input.endTime);
        }
        if (input.metricsJson !== undefined) {
            sets.push(`metrics_json = $${idx++}`);
            values.push(input.metricsJson);
        }
        if (input.resultsJson !== undefined) {
            sets.push(`results_json = $${idx++}`);
            values.push(input.resultsJson);
        }
        values.push(input.testId);
        return asyncExecute(this.conn, `UPDATE prompt_ab_tests SET ${sets.join(", ")} WHERE test_id = $${idx}`, ...values);
    }
    async getPromptAbTest(testId) {
        const result = await asyncQueryOne(this.conn, `SELECT
        test_id AS "testId",
        bundle_id AS "bundleId",
        test_name AS "testName",
        control_version AS "controlVersion",
        treatment_version AS "treatmentVersion",
        traffic_split_percent AS "trafficSplitPercent",
        status,
        start_time AS "startTime",
        end_time AS "endTime",
        metrics_json AS "metricsJson",
        results_json AS "resultsJson",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM prompt_ab_tests WHERE test_id = $1`, testId);
        return result ?? null;
    }
    async listPromptAbTestsByBundle(bundleId) {
        return asyncQueryAll(this.conn, `SELECT
        test_id AS "testId",
        bundle_id AS "bundleId",
        test_name AS "testName",
        control_version AS "controlVersion",
        treatment_version AS "treatmentVersion",
        traffic_split_percent AS "trafficSplitPercent",
        status,
        start_time AS "startTime",
        end_time AS "endTime",
        metrics_json AS "metricsJson",
        results_json AS "resultsJson",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM prompt_ab_tests
       WHERE bundle_id = $1
       ORDER BY created_at DESC`, bundleId);
    }
    async listActiveAbTests() {
        return asyncQueryAll(this.conn, `SELECT
        test_id AS "testId",
        bundle_id AS "bundleId",
        test_name AS "testName",
        control_version AS "controlVersion",
        treatment_version AS "treatmentVersion",
        traffic_split_percent AS "trafficSplitPercent",
        status,
        start_time AS "startTime",
        end_time AS "endTime",
        metrics_json AS "metricsJson",
        results_json AS "resultsJson",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM prompt_ab_tests
       WHERE status = 'running'
       ORDER BY start_time ASC`);
    }
}
//# sourceMappingURL=prompt-repository.js.map