import assert from "node:assert/strict";
import test from "node:test";

import { listVerticalDomainIds } from "../../../src/domains/domain-baseline-catalog.js";

test("every vertical domain exposes a dedicated module with preset and review helper", async () => {
  for (const domainId of listVerticalDomainIds()) {
    const module = await import(`../../../src/domains/${domainId}/index.js`);
    const presetKey = Object.keys(module).find((key) => key.endsWith("_DOMAIN_PRESET"));
    const reviewKey = Object.keys(module).find((key) => key.startsWith("requires") && key.endsWith("Review"));

    assert.ok(presetKey, `${domainId} should export a domain preset`);
    assert.ok(reviewKey, `${domainId} should export a review helper`);

    const preset = module[presetKey] as {
      domainId: string;
      defaultWorkflowIds: readonly string[];
      defaultToolBundleIds: readonly string[];
      reviewRequiredTaskTypes: readonly string[];
    };
    assert.equal(preset.domainId, domainId);
    assert.equal(preset.defaultWorkflowIds.length >= 1, true);
    assert.equal(preset.defaultToolBundleIds.length >= 1, true);
    assert.equal(Array.isArray(preset.reviewRequiredTaskTypes), true);

    const taskSchemaKey = Object.keys(module).find((key) => key.endsWith("TaskTypeSchema"));
    assert.ok(taskSchemaKey, `${domainId} should export a task type schema`);
    const schema = module[taskSchemaKey] as { options?: readonly string[] };
    const candidateTaskType = schema.options?.[0];
    assert.ok(candidateTaskType, `${domainId} should expose at least one task type option`);

    const requiresReview = module[reviewKey] as (taskType: string) => boolean;
    assert.equal(typeof requiresReview(candidateTaskType!), "boolean");
  }
});
