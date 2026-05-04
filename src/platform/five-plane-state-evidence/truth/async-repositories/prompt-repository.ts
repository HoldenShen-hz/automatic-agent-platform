/**
 * AsyncPromptRepository - Async data access for prompt management tables.
 *
 * Implements §26 storage layer - missing tables: prompt_bundles, prompt_versions, prompt_ab_tests
 */

import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";

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

export class AsyncPromptRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  // ================================
  // PROMPT BUNDLES
  // ================================

  public async insertPromptBundle(bundle: PromptBundleRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO prompt_bundles (
        bundle_id, name, version, domain, task_type, pack_id,
        system_prompt_content, user_prompt_content, few_shot_examples_json,
        constraints_json, metadata_json, deprecated, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      bundle.bundleId,
      bundle.name,
      bundle.version,
      bundle.domain,
      bundle.taskType,
      bundle.packId,
      bundle.systemPromptContent,
      bundle.userPromptContent,
      bundle.fewShotExamplesJson,
      bundle.constraintsJson,
      bundle.metadataJson,
      bundle.deprecated,
      bundle.createdAt,
      bundle.updatedAt,
    );
  }

  public async updatePromptBundle(input: {
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
  }): Promise<number> {
    const sets = ["updated_at = $1"];
    const values: unknown[] = [input.updatedAt];
    let idx = 2;

    if (input.version !== undefined) { sets.push(`version = $${idx++}`); values.push(input.version); }
    if (input.domain !== undefined) { sets.push(`domain = $${idx++}`); values.push(input.domain); }
    if (input.taskType !== undefined) { sets.push(`task_type = $${idx++}`); values.push(input.taskType); }
    if (input.packId !== undefined) { sets.push(`pack_id = $${idx++}`); values.push(input.packId); }
    if (input.systemPromptContent !== undefined) { sets.push(`system_prompt_content = $${idx++}`); values.push(input.systemPromptContent); }
    if (input.userPromptContent !== undefined) { sets.push(`user_prompt_content = $${idx++}`); values.push(input.userPromptContent); }
    if (input.fewShotExamplesJson !== undefined) { sets.push(`few_shot_examples_json = $${idx++}`); values.push(input.fewShotExamplesJson); }
    if (input.constraintsJson !== undefined) { sets.push(`constraints_json = $${idx++}`); values.push(input.constraintsJson); }
    if (input.metadataJson !== undefined) { sets.push(`metadata_json = $${idx++}`); values.push(input.metadataJson); }
    if (input.deprecated !== undefined) { sets.push(`deprecated = $${idx++}`); values.push(input.deprecated); }

    values.push(input.bundleId);
    return asyncExecute(
      this.conn,
      `UPDATE prompt_bundles SET ${sets.join(", ")} WHERE bundle_id = $${idx}`,
      ...values,
    );
  }

  public async getPromptBundle(bundleId: string): Promise<PromptBundleRecord | null> {
    const result = await asyncQueryOne<PromptBundleRecord>(
      this.conn,
      `SELECT
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
       FROM prompt_bundles WHERE bundle_id = $1`,
      bundleId,
    );
    return result ?? null;
  }

  public async getPromptBundleByNameVersion(name: string, version: string): Promise<PromptBundleRecord | null> {
    const result = await asyncQueryOne<PromptBundleRecord>(
      this.conn,
      `SELECT
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
       FROM prompt_bundles WHERE name = $1 AND version = $2`,
      name,
      version,
    );
    return result ?? null;
  }

  public async listPromptBundlesByDomain(domain: string, taskType?: string): Promise<PromptBundleRecord[]> {
    if (taskType) {
      return asyncQueryAll<PromptBundleRecord>(
        this.conn,
        `SELECT
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
         WHERE domain = $1 AND task_type = $2 AND deprecated = false
         ORDER BY created_at DESC`,
        domain,
        taskType,
      );
    }
    return asyncQueryAll<PromptBundleRecord>(
      this.conn,
      `SELECT
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
       WHERE domain = $1 AND deprecated = false
       ORDER BY created_at DESC`,
      domain,
    );
  }

  public async listActivePromptBundles(): Promise<PromptBundleRecord[]> {
    return asyncQueryAll<PromptBundleRecord>(
      this.conn,
      `SELECT
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
       WHERE deprecated = false
       ORDER BY domain, task_type, name`,
    );
  }

  // ================================
  // PROMPT VERSIONS
  // ================================

  public async insertPromptVersion(version: PromptVersionRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO prompt_versions (
        version_id, bundle_id, version, is_current, traffic_weight,
        traffic_allocation_json, created_at, deprecated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      version.versionId,
      version.bundleId,
      version.version,
      version.isCurrent,
      version.trafficWeight,
      version.trafficAllocationJson,
      version.createdAt,
      version.deprecatedAt,
    );
  }

  public async setCurrentVersion(bundleId: string, versionId: string): Promise<number> {
    // First, unset is_current for all versions of this bundle
    await asyncExecute(
      this.conn,
      `UPDATE prompt_versions SET is_current = false WHERE bundle_id = $1`,
      bundleId,
    );
    // Then, set is_current for the target version
    return asyncExecute(
      this.conn,
      `UPDATE prompt_versions SET is_current = true WHERE version_id = $1`,
      versionId,
    );
  }

  public async getPromptVersion(versionId: string): Promise<PromptVersionRecord | null> {
    const result = await asyncQueryOne<PromptVersionRecord>(
      this.conn,
      `SELECT
        version_id AS "versionId",
        bundle_id AS "bundleId",
        version,
        is_current AS "isCurrent",
        traffic_weight AS "trafficWeight",
        traffic_allocation_json AS "trafficAllocationJson",
        created_at AS "createdAt",
        deprecated_at AS "deprecatedAt"
       FROM prompt_versions WHERE version_id = $1`,
      versionId,
    );
    return result ?? null;
  }

  public async listPromptVersions(bundleId: string): Promise<PromptVersionRecord[]> {
    return asyncQueryAll<PromptVersionRecord>(
      this.conn,
      `SELECT
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
       ORDER BY created_at DESC`,
      bundleId,
    );
  }

  public async getCurrentVersion(bundleId: string): Promise<PromptVersionRecord | null> {
    const result = await asyncQueryOne<PromptVersionRecord>(
      this.conn,
      `SELECT
        version_id AS "versionId",
        bundle_id AS "bundleId",
        version,
        is_current AS "isCurrent",
        traffic_weight AS "trafficWeight",
        traffic_allocation_json AS "trafficAllocationJson",
        created_at AS "createdAt",
        deprecated_at AS "deprecatedAt"
       FROM prompt_versions
       WHERE bundle_id = $1 AND is_current = true`,
      bundleId,
    );
    return result ?? null;
  }

  // ================================
  // PROMPT AB TESTS
  // ================================

  public async insertPromptAbTest(test: PromptAbTestRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO prompt_ab_tests (
        test_id, bundle_id, test_name, control_version, treatment_version,
        traffic_split_percent, status, start_time, end_time, metrics_json,
        results_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      test.testId,
      test.bundleId,
      test.testName,
      test.controlVersion,
      test.treatmentVersion,
      test.trafficSplitPercent,
      test.status,
      test.startTime,
      test.endTime,
      test.metricsJson,
      test.resultsJson,
      test.createdAt,
      test.updatedAt,
    );
  }

  public async updatePromptAbTest(input: {
    testId: string;
    status?: string;
    startTime?: string | null;
    endTime?: string | null;
    metricsJson?: string;
    resultsJson?: string | null;
    updatedAt: string;
  }): Promise<number> {
    const sets = ["updated_at = $1"];
    const values: unknown[] = [input.updatedAt];
    let idx = 2;

    if (input.status !== undefined) { sets.push(`status = $${idx++}`); values.push(input.status); }
    if (input.startTime !== undefined) { sets.push(`start_time = $${idx++}`); values.push(input.startTime); }
    if (input.endTime !== undefined) { sets.push(`end_time = $${idx++}`); values.push(input.endTime); }
    if (input.metricsJson !== undefined) { sets.push(`metrics_json = $${idx++}`); values.push(input.metricsJson); }
    if (input.resultsJson !== undefined) { sets.push(`results_json = $${idx++}`); values.push(input.resultsJson); }

    values.push(input.testId);
    return asyncExecute(
      this.conn,
      `UPDATE prompt_ab_tests SET ${sets.join(", ")} WHERE test_id = $${idx}`,
      ...values,
    );
  }

  public async getPromptAbTest(testId: string): Promise<PromptAbTestRecord | null> {
    const result = await asyncQueryOne<PromptAbTestRecord>(
      this.conn,
      `SELECT
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
       FROM prompt_ab_tests WHERE test_id = $1`,
      testId,
    );
    return result ?? null;
  }

  public async listPromptAbTestsByBundle(bundleId: string): Promise<PromptAbTestRecord[]> {
    return asyncQueryAll<PromptAbTestRecord>(
      this.conn,
      `SELECT
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
       ORDER BY created_at DESC`,
      bundleId,
    );
  }

  public async listActiveAbTests(): Promise<PromptAbTestRecord[]> {
    return asyncQueryAll<PromptAbTestRecord>(
      this.conn,
      `SELECT
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
       ORDER BY start_time ASC`,
    );
  }
}
