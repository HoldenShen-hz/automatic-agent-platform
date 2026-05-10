/**
 * @fileoverview Integration tests for SDK Workbench Service
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SdkWorkbenchService } from "../../../src/sdk/workbench/index.js";

test("integration: workbench service creates snapshot with real manifest validation", () => {
  const service = new SdkWorkbenchService();
  const snapshot = service.buildSnapshot({
    client: {
      baseUrl: "https://api.example.com",
      apiVersion: "v1",
      tenantId: "enterprise-tenant",
    },
    plugins: [
      {
        pluginId: "plugin.approve",
        version: "1.0.0",
        owner: "admin@example.com",
        spiTypes: ["retriever"],
        publicSdkSurface: "approve-sdk",
        capabilityIds: ["approve", "triage"],
      },
    ] as any,
    packs: [
      {
        packId: "ops-pack",
        version: "1.0.0",
        domainId: "ops",
        domain: "ops",
        owner: "admin@example.com",
        capabilities: [
          { capabilityKey: "approve", maturity: "ga", requiredContracts: ["approval_contract"] },
          { capabilityKey: "triage", maturity: "beta", requiredContracts: ["runtime_contract"] },
        ],
      },
    ],
    availableContracts: ["approval_contract", "runtime_contract"],
  });

  assert.equal(snapshot.apiBaseUrl, "https://api.example.com");
  assert.equal(snapshot.tenantId, "enterprise-tenant");
  assert.ok(snapshot.installPlans[0]?.ready);
});

test("integration: workbench service detects missing contracts across packs", () => {
  const service = new SdkWorkbenchService();
  const snapshot = service.buildSnapshot({
    client: {
      baseUrl: "https://api.example.com",
      apiVersion: "v1",
    },
    plugins: [],
    packs: [
      {
        packId: "marketplace-pack",
        version: "2.0.0",
        domainId: "marketplace",
        domain: "marketplace",
        owner: "seller@example.com",
        capabilities: [
          { capabilityKey: "listing.create", maturity: "ga", requiredContracts: ["marketplace_contract"] },
          { capabilityKey: "payment.process", maturity: "beta", requiredContracts: ["payment_contract"] },
        ],
      },
    ],
    availableContracts: ["runtime_execution_contract"],
  });

  assert.ok(snapshot.missingContracts.includes("marketplace_contract"));
  assert.ok(snapshot.missingContracts.includes("payment_contract"));
  assert.equal(snapshot.installPlans[0]?.ready, false);
});

test("integration: workbench publish readiness with all contracts satisfied", () => {
  const service = new SdkWorkbenchService();
  const report = service.buildPublishReadiness({
    client: {
      baseUrl: "https://api.example.com",
      apiVersion: "v1",
    },
    plugins: [
      {
        pluginId: "plugin.coding",
        version: "1.0.0",
        owner: "dev@example.com",
        spiTypes: ["retriever"],
        publicSdkSurface: "coding-sdk",
        capabilityIds: ["code.completion"],
      },
    ] as any,
    packs: [
      {
        packId: "coding-pack",
        version: "1.0.0",
        domainId: "coding",
        domain: "coding",
        owner: "dev@example.com",
        capabilities: [
          { capabilityKey: "code.completion", maturity: "ga", requiredContracts: ["coding_contract"] },
        ],
      },
    ],
    availableContracts: ["coding_contract"],
  });

  assert.equal(report.ready, true);
  assert.deepEqual(report.findings, []);
});

test("integration: workbench shortcuts contain valid preview URLs", () => {
  const service = new SdkWorkbenchService();
  const shortcuts = service.listWorkbenchShortcuts({
    baseUrl: "https://api.example.com",
    apiVersion: "v2",
  });

  assert.ok(shortcuts.length > 0);

  // Check task list shortcut
  const taskShortcut = shortcuts.find((s) => s.shortcutId === "sdk.tasks.list");
  assert.ok(taskShortcut);
  assert.ok(taskShortcut!.previewUrl!.includes("/v2/harness-runs"));

  // Check packs shortcut
  const packsShortcut = shortcuts.find((s) => s.shortcutId === "sdk.packs.list");
  assert.ok(packsShortcut);
  assert.ok(packsShortcut!.previewUrl!.includes("/v2/packs"));
});

test("integration: workbench creates install plan with plugin assignments", () => {
  const service = new SdkWorkbenchService();
  const plan = service.createInstallPlan({
    pack: {
      packId: "billing-pack",
      version: "1.0.0",
      domain: "billing",
      owner: "finance@example.com",
      capabilities: [
        { capabilityKey: "invoice.create", maturity: "ga", requiredContracts: ["billing_contract"] },
        { capabilityKey: "payment.process", maturity: "ga", requiredContracts: ["billing_contract"] },
        { capabilityKey: "refund.issue", maturity: "beta", requiredContracts: ["billing_contract"] },
      ],
    },
    plugins: [
      {
        pluginId: "plugin.billing",
        version: "1.0.0",
        owner: "finance@example.com",
        spiTypes: ["adapter"],
        publicSdkSurface: "billing-sdk",
        capabilityIds: ["invoice.create", "payment.process"],
      },
    ] as any,
  });

  assert.equal(plan.packId, "billing-pack");
  assert.equal(plan.pluginAssignments.length, 2);
  assert.ok(plan.pluginAssignments.some((a) => a.capabilityKey === "invoice.create"));
  assert.ok(plan.pluginAssignments.some((a) => a.capabilityKey === "payment.process"));
  assert.deepEqual(plan.unresolvedCapabilities, ["refund.issue"]);
  assert.equal(plan.ready, false);
});
