import assert from "node:assert/strict";
import test from "node:test";

import {
  listVerticalDomainBaselines,
  listVerticalDomainIds,
} from "../../../src/domains/domain-baseline-catalog.js";

/**
 * [ARCH-P1-6] Vertical Domain Specialization Coverage
 *
 * Verifies that all 24 vertical domains (per architecture §71-§94) have:
 * 1. Specialized workflows beyond generic 2-step skeleton
 * 2. Domain-specific tool bundles
 * 3. Evaluation metrics
 *
 * Reference: docs_zh/quality/00-full-coverage-test-manual.md §26.6
 */

test("[ARCH-P1-6] all vertical domains have specialized workflows beyond generic 2-step", () => {
  const baselines = listVerticalDomainBaselines();
  assert.ok(baselines.length >= 24, "Must have at least 24 domains registered");

  const failures: string[] = [];
  for (const baseline of baselines) {
    const workflows = baseline.definition.workflows;
    const hasSpecialized = workflows.some((w) => w.steps.length > 2);
    if (!hasSpecialized) {
      failures.push(
        `"${baseline.domainId}" has no specialized workflow (all workflows have <= 2 steps)`,
      );
    }
  }

  assert.equal(
    failures.length,
    0,
    `Domains missing specialized workflows:\n${failures.join("\n")}`,
  );
});

test("[ARCH-P1-6] all vertical domains define domain-specific tool bundle", () => {
  const baselines = listVerticalDomainBaselines();

  const failures: string[] = [];
  for (const baseline of baselines) {
    const bundles = baseline.definition.toolBundles;
    const hasBundle = bundles.length > 0 && bundles[0]!.tools.length > 0;
    if (!hasBundle) {
      failures.push(`"${baseline.domainId}" has no tool bundle or empty tool bundle`);
    }
  }

  assert.equal(
    failures.length,
    0,
    `Domains missing tool bundles:\n${failures.join("\n")}`,
  );
});

test("[ARCH-P1-6] all vertical domains define evaluation metrics", () => {
  const baselines = listVerticalDomainBaselines();

  const failures: string[] = [];
  for (const baseline of baselines) {
    const blockingMetrics = baseline.evalSpecialization.blockingMetricIds;
    const advisoryMetrics = baseline.evalSpecialization.advisoryMetricIds;
    const hasMetrics = blockingMetrics.length > 0 || advisoryMetrics.length > 0;
    if (!hasMetrics) {
      failures.push(`"${baseline.domainId}" has no evaluation metrics (blocking: ${blockingMetrics.length}, advisory: ${advisoryMetrics.length})`);
    }
  }

  assert.equal(
    failures.length,
    0,
    `Domains missing evaluation metrics:\n${failures.join("\n")}`,
  );
});

test("[ARCH-P1-6] each domain workflow has domain-specific stage names (not generic)", () => {
  const baselines = listVerticalDomainBaselines();

  const failures: string[] = [];
  for (const baseline of baselines) {
    const workflow = baseline.definition.workflows[0];
    if (!workflow) {
      failures.push(`"${baseline.domainId}" has no primary workflow`);
      continue;
    }

    // Stage names should be domain-specific, not generic placeholders
    const genericStageNames = ["step_1", "step_2", "observe", "assess", "plan", "execute", "release"];
    const hasDomainSpecificStages = workflow.steps.some(
      (step) => !genericStageNames.includes(step.stepName),
    );

    if (!hasDomainSpecificStages) {
      failures.push(
        `"${baseline.domainId}" workflow stages are all generic: ${workflow.steps.map((s) => s.stepName).join(", ")}`,
      );
    }
  }

  assert.equal(
    failures.length,
    0,
    `Domains with generic-only stage names:\n${failures.join("\n")}`,
  );
});

test("[ARCH-P1-6] each domain tool bundle contains domain-specific tool names", () => {
  const baselines = listVerticalDomainBaselines();

  const failures: string[] = [];
  for (const baseline of baselines) {
    const bundle = baseline.definition.toolBundles[0];
    if (!bundle || bundle.tools.length === 0) {
      failures.push(`"${baseline.domainId}" has no tools in bundle`);
      continue;
    }

    // Tool names should not all be generic placeholders
    const genericToolNames = ["generic_tool", "placeholder", "todo_tool"];
    const allGeneric = bundle.tools.every(
      (t) => genericToolNames.includes(t.toolName),
    );

    if (allGeneric) {
      failures.push(
        `"${baseline.domainId}" tool bundle contains only generic tools: ${bundle.tools.map((t) => t.toolName).join(", ")}`,
      );
    }
  }

  assert.equal(
    failures.length,
    0,
    `Domains with generic-only tool names:\n${failures.join("\n")}`,
  );
});

test("[ARCH-P1-6] all 24 domains have workflow specialization metadata with exit criteria", () => {
  const baselines = listVerticalDomainBaselines();

  const failures: string[] = [];
  for (const baseline of baselines) {
    const spec = baseline.workflowSpecialization;
    if (!spec.exitCriteria || spec.exitCriteria.length === 0) {
      failures.push(`"${baseline.domainId}" missing exit criteria in workflow specialization`);
    }
    if (!spec.stageNames || spec.stageNames.length === 0) {
      failures.push(`"${baseline.domainId}" missing stage names in workflow specialization`);
    }
  }

  assert.equal(
    failures.length,
    0,
    `Domains missing workflow specialization metadata:\n${failures.join("\n")}`,
  );
});

test("[ARCH-P1-6] all domains have tooling specialization with required and optional tools", () => {
  const baselines = listVerticalDomainBaselines();

  const failures: string[] = [];
  for (const baseline of baselines) {
    const spec = baseline.toolingSpecialization;
    if (!spec.requiredToolNames || spec.requiredToolNames.length === 0) {
      failures.push(`"${baseline.domainId}" missing required tool names in tooling specialization`);
    }
  }

  assert.equal(
    failures.length,
    0,
    `Domains missing tooling specialization:\n${failures.join("\n")}`,
  );
});

test("[ARCH-P1-6] all domains have eval specialization with blocking and advisory metrics", () => {
  const baselines = listVerticalDomainBaselines();

  const failures: string[] = [];
  for (const baseline of baselines) {
    const spec = baseline.evalSpecialization;
    if (!spec.blockingMetricIds || spec.blockingMetricIds.length === 0) {
      failures.push(`"${baseline.domainId}" missing blocking metrics in eval specialization`);
    }
    if (!spec.advisoryMetricIds || spec.advisoryMetricIds.length === 0) {
      failures.push(`"${baseline.domainId}" missing advisory metrics in eval specialization`);
    }
  }

  assert.equal(
    failures.length,
    0,
    `Domains missing eval specialization:\n${failures.join("\n")}`,
  );
});