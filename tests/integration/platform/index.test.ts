import assert from "node:assert/strict";
import test from "node:test";

import * as platform from "../../../src/platform/index.js";
import * as contracts from "../../../src/platform/contracts/index.js";
import * as controlPlane from "../../../src/platform/five-plane-control-plane/index.js";
import * as execution from "../../../src/platform/five-plane-execution/index.js";
import * as interfacePlane from "../../../src/platform/five-plane-interface/index.js";
import * as modelGateway from "../../../src/platform/model-gateway/index.js";
import * as orchestration from "../../../src/platform/five-plane-orchestration/index.js";
import * as promptEngine from "../../../src/platform/prompt-engine/index.js";
import * as shared from "../../../src/platform/shared/index.js";
import * as stateEvidence from "../../../src/platform/five-plane-state-evidence/index.js";
import * as compliance from "../../../src/platform/compliance/index.js";

test("platform index exports all five planes as namespace objects", () => {
  assert.ok(platform.contracts, "contracts namespace exported");
  assert.ok(platform.controlPlane, "controlPlane namespace exported");
  assert.ok(platform.execution, "execution namespace exported");
  assert.ok(platform.interfacePlane, "interfacePlane namespace exported");
  assert.ok(platform.modelGateway, "modelGateway namespace exported");
  assert.ok(platform.orchestration, "orchestration namespace exported");
  assert.ok(platform.promptEngine, "promptEngine namespace exported");
  assert.ok(platform.shared, "shared namespace exported");
  assert.ok(platform.stateEvidence, "stateEvidence namespace exported");
  assert.ok(platform.compliance, "compliance namespace exported");
});

test("platform contracts namespace exports executable contracts", () => {
  assert.ok(contracts.executableContracts, "executableContracts exported");
});

test("platform control-plane namespace is accessible", () => {
  assert.ok(controlPlane, "controlPlane namespace is object");
  assert.ok(typeof controlPlane === "object", "controlPlane is an object");
});

test("platform execution namespace exposes core services", () => {
  assert.ok(execution, "execution namespace is object");
  assert.equal(typeof execution.ExecutionLeaseService, "function");
  assert.equal(typeof execution.HaCoordinatorService, "function");
  assert.equal(typeof execution.TransitionService, "function");
});

test("platform interface-plane namespace is accessible", () => {
  assert.ok(interfacePlane, "interfacePlane namespace is object");
  assert.ok(typeof interfacePlane === "object", "interfacePlane is an object");
});

test("platform model-gateway namespace is accessible", () => {
  assert.ok(modelGateway, "modelGateway namespace is object");
  assert.ok(typeof modelGateway === "object", "modelGateway is an object");
});

test("platform orchestration namespace exposes core services", () => {
  assert.ok(orchestration, "orchestration namespace is object");
  assert.equal(typeof orchestration.HitlApprovalOrchestrationService, "function");
  assert.equal(typeof orchestration.OapeflirLoopService, "function");
  assert.equal(typeof orchestration.TaskDecompositionService, "function");
});

test("platform prompt-engine namespace is accessible", () => {
  assert.ok(promptEngine, "promptEngine namespace is object");
  assert.ok(typeof promptEngine === "object", "promptEngine is an object");
});

test("platform shared namespace is accessible", () => {
  assert.ok(shared, "shared namespace is object");
  assert.ok(typeof shared === "object", "shared is an object");
});

test("platform state-evidence namespace is accessible", () => {
  assert.ok(stateEvidence, "stateEvidence namespace is object");
  assert.ok(typeof stateEvidence === "object", "stateEvidence is an object");
});

test("platform compliance namespace is accessible", () => {
  assert.ok(compliance, "compliance namespace is object");
  assert.ok(typeof compliance === "object", "compliance is an object");
});

test("platform index exports runtime catalog builders", () => {
  assert.equal(typeof platform.buildAiOperationsRuntimeCatalog, "function");
  assert.equal(typeof platform.buildAiOperationsStartupPlan, "function");
  assert.equal(typeof platform.buildFivePlaneRuntimeCatalog, "function");
  assert.equal(typeof platform.buildFivePlaneStartupPlan, "function");
});

test("platform index exports runtime orchestrator registration functions", () => {
  assert.equal(typeof platform.registerAiOperationsRuntimeCatalog, "function");
  assert.equal(typeof platform.registerFivePlaneRuntimeCatalog, "function");
});

test("platform index exports bootstrap builders", () => {
  assert.equal(typeof platform.buildModelGatewayBootstrap, "function");
  assert.equal(typeof platform.buildInterfacePlaneBootstrap, "function");
  assert.equal(typeof platform.buildX1FabricBootstrap, "function");
});

test("platform index exports harness and registry services", () => {
  assert.equal(typeof platform.HarnessRuntimeService, "function");
  assert.equal(typeof platform.PromptTemplateRegistryService, "function");
});

test("platform index exports webhook services", () => {
  assert.equal(typeof platform.WebhookIngressService, "function");
  assert.equal(typeof platform.WebhookOutboxDispatchService, "function");
});

test("platform index exports execution services", () => {
  assert.equal(typeof platform.ExecutionLeaseService, "function");
  assert.equal(typeof platform.HaCoordinatorService, "function");
  assert.equal(typeof platform.TransitionService, "function");
  assert.equal(typeof platform.executeToolCall, "function");
  assert.equal(typeof platform.resetToolRegistry, "function");
});

test("platform index exports orchestration services", () => {
  assert.equal(typeof platform.HitlApprovalOrchestrationService, "function");
  assert.equal(typeof platform.OapeflirLoopService, "function");
  assert.equal(typeof platform.TaskDecompositionService, "function");
});

test("platform index exports registration functions", () => {
  assert.equal(typeof platform.registerPlatformSurfaceCatalog, "function");
});
