import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  DEFAULT_BILLING_PLAN_CATALOG,
  loadBillingPlanCatalog,
} from "../../../../../src/platform/control-plane/config-center/billing-plan-catalog.js";
import { createWorkspaceWritePolicy } from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../../helpers/fs.js";

test("billing plan catalog falls back to bundled defaults when config file is absent", () => {
  const workspace = createTempWorkspace("aa-billing-plan-defaults-");
  const configRoot = join(workspace, "config");

  try {
    const catalog = loadBillingPlanCatalog({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });
    assert.equal(catalog.enterprise?.planId, DEFAULT_BILLING_PLAN_CATALOG.enterprise?.planId);
    assert.equal(catalog.pro?.quotas.task_execution?.limitValue, 1000);
  } finally {
    cleanupPath(workspace);
  }
});

test("billing plan catalog loads configured plan overrides from config/product/default.json", () => {
  const workspace = createTempWorkspace("aa-billing-plan-config-");
  const configRoot = join(workspace, "config");

  try {
    createFile(join(configRoot, "product", "default.json"), JSON.stringify({
      billingPlans: {
        tiny: {
          planId: "tiny",
          displayName: "Tiny",
          features: ["phase3.billing_export"],
          quotas: {
            task_execution: {
              metricType: "task_execution",
              limitType: "hard",
              limitValue: 10,
              resetPolicy: "calendar_month",
              unitPriceUsd: 0.25,
            },
          },
        },
      },
    }, null, 2));

    const catalog = loadBillingPlanCatalog({
      configRoot,
      sandboxPolicy: createWorkspaceWritePolicy(configRoot),
    });
    assert.deepEqual(Object.keys(catalog), ["tiny"]);
    assert.equal(catalog.tiny?.quotas.task_execution?.limitValue, 10);
  } finally {
    cleanupPath(workspace);
  }
});

test("billing plan catalog rejects malformed quota definitions", () => {
  const workspace = createTempWorkspace("aa-billing-plan-invalid-");
  const configRoot = join(workspace, "config");

  try {
    createFile(join(configRoot, "product", "default.json"), JSON.stringify({
      billingPlans: {
        broken: {
          planId: "broken",
          displayName: "Broken",
          features: ["phase3.billing_export"],
          quotas: {
            task_execution: {
              metricType: "task_execution",
              limitType: "hard",
              limitValue: 0,
              resetPolicy: "calendar_month",
              unitPriceUsd: 0,
            },
          },
        },
      },
    }, null, 2));

    assert.throws(
      () => loadBillingPlanCatalog({
        configRoot,
        sandboxPolicy: createWorkspaceWritePolicy(configRoot),
      }),
      /limit_value_invalid/,
    );
  } finally {
    cleanupPath(workspace);
  }
});
