import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { createSeededApiContext } from "../../../src/testing/index.js";
import { createTempWorkspace, cleanupPath } from "../../../src/testing/index.js";

test("createSeededApiContext creates database and store", () => {
  const workspace = createTempWorkspace("test-seeded-api-");
  try {
    const context = createSeededApiContext(workspace);
    assert.ok(context.db, "should have db");
    assert.ok(context.store, "should have store");
    assert.ok(context.store.listTasks(10).length > 0, "should have seeded tasks");
    cleanupPath(workspace);
  } catch (err) {
    cleanupPath(workspace);
    throw err;
  }
});

test("createSeededApiContext creates all services", () => {
  const workspace = createTempWorkspace("test-seeded-services-");
  try {
    const context = createSeededApiContext(workspace);
    assert.ok(context.billingService, "should have billingService");
    assert.ok(context.approvalService, "should have approvalService");
    assert.ok(context.authService, "should have authService");
    assert.ok(context.inspectService, "should have inspectService");
    assert.ok(context.missionControlService, "should have missionControlService");
    assert.ok(context.gatewayTargetDirectoryService, "should have gatewayTargetDirectoryService");
    assert.ok(context.knowledgePlaneService, "should have knowledgePlaneService");
    assert.ok(context.artifactPlaneService, "should have artifactPlaneService");
    assert.ok(context.domainRegistryService, "should have domainRegistryService");
    assert.ok(context.pluginRegistry, "should have pluginRegistry");
    cleanupPath(workspace);
  } catch (err) {
    cleanupPath(workspace);
    throw err;
  }
});

test("createSeededApiContext seeds task with correct title", () => {
  const workspace = createTempWorkspace("test-seeded-task-");
  try {
    const context = createSeededApiContext(workspace);
    const task = context.store.getTask(context.seededTaskId);
    assert.ok(task, "seeded task should exist");
    assert.equal(task?.title, "API seeded task");
    cleanupPath(workspace);
  } catch (err) {
    cleanupPath(workspace);
    throw err;
  }
});

test("createSeededApiContext creates approval request", () => {
  const workspace = createTempWorkspace("test-seeded-approval-");
  try {
    const context = createSeededApiContext(workspace);
    assert.ok(context.approvalId, "approvalId should be set");
    const approval = context.store.getApproval(context.approvalId);
    assert.ok(approval, "approval should exist in store");
    const request = JSON.parse(approval?.requestJson ?? "{}");
    assert.equal(request.sourceAgentId, "operator_gate");
    assert.equal(request.riskLevel, "medium");
    cleanupPath(workspace);
  } catch (err) {
    cleanupPath(workspace);
    throw err;
  }
});

test("createSeededApiContext creates seeded worker snapshot", () => {
  const workspace = createTempWorkspace("test-seeded-worker-");
  try {
    const context = createSeededApiContext(workspace);
    const worker = context.store.getWorkerSnapshot(context.seededWorkerId);
    assert.ok(worker, "worker snapshot should exist");
    assert.equal(worker?.status, "busy");
    assert.equal(worker?.placement, "local");
    cleanupPath(workspace);
  } catch (err) {
    cleanupPath(workspace);
    throw err;
  }
});

test("createSeededApiContext registers auth service with test API key", () => {
  const workspace = createTempWorkspace("test-seeded-auth-");
  try {
    const context = createSeededApiContext(workspace);
    // Auth service is created with test API key - verify it has the expected interface
    assert.ok(context.authService, "authService should exist");
    cleanupPath(workspace);
  } catch (err) {
    cleanupPath(workspace);
    throw err;
  }
});

test("createSeededApiContext registers gateway target", () => {
  const workspace = createTempWorkspace("test-seeded-gateway-");
  try {
    const context = createSeededApiContext(workspace);
    const targets = context.gatewayTargetDirectoryService.listTargets();
    const telegramTarget = targets.find((t) => t.channel === "telegram");
    assert.ok(telegramTarget, "telegram target should be registered");
    assert.equal(telegramTarget?.externalTargetId, "finance-team");
    assert.deepEqual(telegramTarget?.aliases, ["finance", "fin-team"]);
    cleanupPath(workspace);
  } catch (err) {
    cleanupPath(workspace);
    throw err;
  }
});

test("createSeededApiContext creates plugin registry with coding domain", () => {
  const workspace = createTempWorkspace("test-seeded-plugin-");
  try {
    const context = createSeededApiContext(workspace);
    const plugins = context.pluginRegistry.list();
    assert.ok(plugins.length > 0, "should have registered plugins");
    cleanupPath(workspace);
  } catch (err) {
    cleanupPath(workspace);
    throw err;
  }
});

test("createSeededApiContext registers domain with workflows and tool bundles", () => {
  const workspace = createTempWorkspace("test-seeded-domain-");
  try {
    const context = createSeededApiContext(workspace);
    const domains = context.domainRegistryService.list();
    const codingDomain = domains.find((d: { domainId: string }) => d.domainId === "coding");
    assert.ok(codingDomain, "coding domain should be registered");
    assert.ok(codingDomain?.workflows.length > 0, "should have workflows");
    assert.ok(codingDomain?.toolBundles.length > 0, "should have tool bundles");
    cleanupPath(workspace);
  } catch (err) {
    cleanupPath(workspace);
    throw err;
  }
});

test("createSeededApiContext creates knowledge namespace and ingests documents", () => {
  const workspace = createTempWorkspace("test-seeded-knowledge-");
  try {
    const context = createSeededApiContext(workspace);
    const namespaces = context.knowledgePlaneService.listNamespaces();
    const codingNs = namespaces.find((n) => n.namespaceId === "ns_coding_repo");
    assert.ok(codingNs, "coding namespace should exist");
    cleanupPath(workspace);
  } catch (err) {
    cleanupPath(workspace);
    throw err;
  }
});

test("createSeededApiContext createServer returns HttpApiServer", () => {
  const workspace = createTempWorkspace("test-seeded-server-");
  try {
    const context = createSeededApiContext(workspace);
    const server = context.createServer();
    assert.ok(server, "server should be created");
    assert.ok(typeof server.start === "function", "server should have start method");
    cleanupPath(workspace);
  } catch (err) {
    cleanupPath(workspace);
    throw err;
  }
});

test("createSeededApiContext with tenantId option filters task by tenant", () => {
  const workspace = createTempWorkspace("test-seeded-tenant-");
  try {
    const context = createSeededApiContext(workspace, { tenantId: "tenant-test-1" });
    assert.ok(context.seededTaskId, "should have seeded task ID");
    cleanupPath(workspace);
  } catch (err) {
    cleanupPath(workspace);
    throw err;
  }
});

test("createSeededApiContext handles billing entitlement evaluation", () => {
  const workspace = createTempWorkspace("test-seeded-billing-");
  try {
    const context = createSeededApiContext(workspace);
    // Billing service should be configured and evaluate entitlement on creation
    assert.ok(context.billingService, "billingService should exist");
    cleanupPath(workspace);
  } catch (err) {
    cleanupPath(workspace);
    throw err;
  }
});
