/**
 * @fileoverview Unit tests for SdkWorkbenchService
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SdkWorkbenchService } from "../../../../src/sdk/workbench/index.js";

test("SdkWorkbenchService.buildSnapshot creates snapshot with all inputs", () => {
  const service = new SdkWorkbenchService();
  const snapshot = service.buildSnapshot({
    client: {
      baseUrl: "https://api.example.com",
      apiVersion: "v1",
      tenantId: "tenant-123",
    },
    plugins: [
      {
        pluginId: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        owner: "owner@example.com",
        spiTypes: ["tool"],
        publicSdkSurface: "test-sdk",
        capabilityIds: ["test.capability"],
      },
    ] as any,
    packs: [
      {
        packId: "test-pack",
        version: "1.0.0",
        domainId: "test",
        owner: "owner@example.com",
        capabilities: [
          { capabilityKey: "test.capability", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
        ],
        signing: { keyId: "test-key", signature: "test-sig" },
      },
    ],
    availableContracts: ["runtime_execution_contract"],
  });

  assert.equal(snapshot.apiBaseUrl, "https://api.example.com");
  assert.equal(snapshot.apiVersion, "v1");
  assert.equal(snapshot.tenantId, "tenant-123");
  assert.ok(snapshot.pluginIds.includes("test-plugin"));
  assert.ok(snapshot.packIds.includes("test-pack"));
  assert.ok(snapshot.capabilityCatalog.includes("test.capability"));
});

test("SdkWorkbenchService.buildSnapshot detects missing contracts", () => {
  const service = new SdkWorkbenchService();
  const snapshot = service.buildSnapshot({
    client: {
      baseUrl: "https://api.example.com",
      apiVersion: "v1",
    },
    plugins: [],
    packs: [
      {
        packId: "test-pack",
        version: "1.0.0",
        domainId: "test",
        owner: "owner@example.com",
        capabilities: [
          { capabilityKey: "test.capability", maturity: "ga", requiredContracts: ["missing_contract"] },
        ],
        signing: { keyId: "test-key", signature: "test-sig" },
      },
    ],
    availableContracts: ["runtime_execution_contract"],
  });

  assert.ok(snapshot.missingContracts.includes("missing_contract"));
  assert.ok(snapshot.installPlans[0]?.unresolvedCapabilities.includes("test.capability"));
});

test("SdkWorkbenchService.createInstallPlan matches plugins to pack capabilities", () => {
  const service = new SdkWorkbenchService();
  const plan = service.createInstallPlan({
    pack: {
      packId: "ops-pack",
      version: "1.0.0",
      domainId: "ops",
      owner: "owner@example.com",
      capabilities: [
        { capabilityKey: "approve", maturity: "ga", requiredContracts: ["approval_contract"] },
        { capabilityKey: "triage", maturity: "beta", requiredContracts: ["runtime_contract"] },
      ],
      signing: { keyId: "test-key", signature: "test-sig" },
    },
    plugins: [
      {
        pluginId: "approve-plugin",
        name: "Approve Plugin",
        version: "1.0.0",
        owner: "owner@example.com",
        spiTypes: ["retriever"],
        publicSdkSurface: "test-sdk",
        capabilityIds: ["approve"],
      },
    ] as any,
  });

  assert.equal(plan.packId, "ops-pack");
  assert.ok(plan.pluginAssignments.some((a) => a.capabilityKey === "approve"));
  assert.ok(plan.unresolvedCapabilities.includes("triage"));
  assert.equal(plan.ready, false);
});

test("SdkWorkbenchService.createInstallPlan resolves all capabilities when plugins match", () => {
  const service = new SdkWorkbenchService();
  const plan = service.createInstallPlan({
    pack: {
      packId: "ops-pack",
      version: "1.0.0",
      domainId: "ops",
      owner: "owner@example.com",
      capabilities: [
        { capabilityKey: "approve", maturity: "ga", requiredContracts: ["approval_contract"] },
      ],
      signing: { keyId: "test-key", signature: "test-sig" },
    },
    plugins: [
      {
        pluginId: "approve-plugin",
        name: "Approve Plugin",
        version: "1.0.0",
        owner: "owner@example.com",
        spiTypes: ["retriever"],
        publicSdkSurface: "test-sdk",
        capabilityIds: ["approve"],
      },
    ] as any,
  });

  assert.equal(plan.ready, true);
  assert.equal(plan.unresolvedCapabilities.length, 0);
});

test("SdkWorkbenchService.buildPublishReadiness throws for empty workspace", () => {
  const service = new SdkWorkbenchService();
  assert.throws(
    () =>
      service.buildPublishReadiness({
        client: { baseUrl: "https://api.example.com", apiVersion: "v1" },
        plugins: [],
        packs: [],
        availableContracts: [],
      }),
    /SDK workbench requires at least one plugin or pack/,
  );
});

test("SdkWorkbenchService.buildPublishReadiness returns findings for unresolved capabilities", () => {
  const service = new SdkWorkbenchService();
  const report = service.buildPublishReadiness({
    client: { baseUrl: "https://api.example.com", apiVersion: "v1" },
    plugins: [
      {
        pluginId: "approve-plugin",
        name: "Approve Plugin",
        version: "1.0.0",
        owner: "owner@example.com",
        spiTypes: ["retriever"],
        publicSdkSurface: "test-sdk",
        capabilityIds: [],
      },
    ] as any,
    packs: [
      {
        packId: "ops-pack",
        version: "1.0.0",
        domainId: "ops",
        owner: "owner@example.com",
        capabilities: [
          { capabilityKey: "approve", maturity: "ga", requiredContracts: ["approval_contract"] },
        ],
        signing: { keyId: "test-key", signature: "test-sig" },
      },
    ],
    availableContracts: [],
  });

  assert.equal(report.ready, false);
  assert.ok(report.findings.some((f) => f.includes("unresolved capabilities")));
});

test("SdkWorkbenchService.buildPublishReadiness returns preview URLs", () => {
  const service = new SdkWorkbenchService();
  const report = service.buildPublishReadiness({
    client: { baseUrl: "https://api.example.com", apiVersion: "v1" },
    plugins: [],
    packs: [
      {
        packId: "ops-pack",
        version: "1.0.0",
        domainId: "ops",
        owner: "owner@example.com",
        capabilities: [
          { capabilityKey: "approve", maturity: "ga", requiredContracts: ["approval_contract"] },
        ],
        signing: { keyId: "test-key", signature: "test-sig" },
      },
    ],
    availableContracts: ["approval_contract"],
  });

  assert.ok(report.previewUrls.length > 0);
  assert.ok(report.previewUrls.some((u) => u.includes("/v1/harness-runs")));
  assert.ok(report.previewUrls.some((u) => u.includes("/v1/packs")));
});

test("SdkWorkbenchService.listWorkbenchShortcuts returns shortcut list", () => {
  const service = new SdkWorkbenchService();
  const shortcuts = service.listWorkbenchShortcuts({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
  });

  assert.ok(shortcuts.length > 0);
  assert.ok(shortcuts.some((s) => s.shortcutId === "sdk.tasks.list"));
  assert.ok(shortcuts.some((s) => s.shortcutId === "sdk.packs.list"));
  assert.ok(shortcuts.some((s) => s.kind === "cli"));
  assert.ok(shortcuts.some((s) => s.kind === "docs"));
});
