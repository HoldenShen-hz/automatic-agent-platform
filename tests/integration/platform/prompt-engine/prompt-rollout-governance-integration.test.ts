import { createIntegrationContext } from "../../../helpers/integration-context.js";
import assert from "node:assert/strict";
import test from "node:test";

import { LlmEvalService } from "../../../../src/platform/prompt-engine/eval/llm-eval-service.js";
import { PromptModelPolicyGovernanceService } from "../../../../src/platform/prompt-engine/eval/prompt-model-policy-governance-service.js";
import { PromptTemplateRegistryService } from "../../../../src/platform/prompt-engine/registry/index.js";
import { PromptRendererService } from "../../../../src/platform/prompt-engine/renderer/index.js";
import { PromptRolloutService } from "../../../../src/platform/prompt-engine/rollout/index.js";

test("integration: prompt registry, renderer, rollout, and governance form a controlled release chain", () => {
  const ctx = createIntegrationContext("aa-prompt-rollout-");
  const evalService = new LlmEvalService(ctx.db);
  const governance = new PromptModelPolicyGovernanceService(ctx.db, evalService);
  const registry = new PromptTemplateRegistryService();
  const renderer = new PromptRendererService();
  const rollout = new PromptRolloutService();
  try {
    const template = registry.registerTemplate({
      templateKey: "ops_triage",
      version: "v2",
      owner: "ops@example.com",
      fixedPrefix: "System guardrails",
      domainBlock: "Operations domain",
      variableSuffixTemplate: "Question: {{question}}",
      variableSpecs: [{ key: "question", required: true }],
    });
    const rendered = renderer.render({ template, variables: { question: "CPU high" } });
    const rolloutRecord = rollout.createRollout({
      template,
      mode: "shadow",
      owner: "ops@example.com",
      regressionSuiteId: "suite_ops",
      regressionPassed: true,
      domainBlockCompatible: true,
    });
    const release = governance.registerPromptRelease({
      promptKey: template.templateKey,
      version: template.version,
      owner: template.owner,
      reviewRequired: false,
      rolloutScope: rolloutRecord.mode,
      lintEvidence: [template.fixedPrefixHash],
    });

    assert.match(rendered.prompt, /CPU high/);
    assert.equal(rolloutRecord.status, "ready");
    assert.equal(release.status, "approved");
  } finally {
    ctx.cleanup();
  }
});
