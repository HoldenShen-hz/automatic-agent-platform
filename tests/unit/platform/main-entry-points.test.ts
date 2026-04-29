import assert from "node:assert/strict";
import test from "node:test";

import * as platform from "../../../src/platform/index.js";

test("platform index exports contracts namespace", () => {
  assert.ok("contracts" in platform, "should export contracts namespace");
  assert.ok(typeof platform.contracts === "object", "contracts should be an object");
});

test("platform index exports controlPlane namespace", () => {
  assert.ok("controlPlane" in platform, "should export controlPlane namespace");
  assert.ok(typeof platform.controlPlane === "object", "controlPlane should be an object");
});

test("platform index exports execution namespace", () => {
  assert.ok("execution" in platform, "should export execution namespace");
  assert.ok(typeof platform.execution === "object", "execution should be an object");
});

test("platform index exports interfacePlane namespace", () => {
  assert.ok("interfacePlane" in platform, "should export interfacePlane namespace");
  assert.ok(typeof platform.interfacePlane === "object", "interfacePlane should be an object");
});

test("platform index exports modelGateway namespace", () => {
  assert.ok("modelGateway" in platform, "should export modelGateway namespace");
  assert.ok(typeof platform.modelGateway === "object", "modelGateway should be an object");
});

test("platform index exports orchestration namespace", () => {
  assert.ok("orchestration" in platform, "should export orchestration namespace");
  assert.ok(typeof platform.orchestration === "object", "orchestration should be an object");
});

test("platform index exports promptEngine namespace", () => {
  assert.ok("promptEngine" in platform, "should export promptEngine namespace");
  assert.ok(typeof platform.promptEngine === "object", "promptEngine should be an object");
});

test("platform index exports shared namespace", () => {
  assert.ok("shared" in platform, "should export shared namespace");
  assert.ok(typeof platform.shared === "object", "shared should be an object");
});

test("platform index exports stateEvidence namespace", () => {
  assert.ok("stateEvidence" in platform, "should export stateEvidence namespace");
  assert.ok(typeof platform.stateEvidence === "object", "stateEvidence should be an object");
});

test("platform index exports compliance namespace", () => {
  assert.ok("compliance" in platform, "should export compliance namespace");
  assert.ok(typeof platform.compliance === "object", "compliance should be an object");
});

test("platform index exports five-plane runtime bootstrap functions", () => {
  assert.ok("buildFivePlaneRuntimeCatalog" in platform, "should export buildFivePlaneRuntimeCatalog");
  assert.ok("registerFivePlaneRuntimeCatalog" in platform, "should export registerFivePlaneRuntimeCatalog");
  assert.ok("FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID" in platform, "should export FIVE_PLANE_RUNTIME_CATALOG_SERVICE_ID");
  assert.ok("X1_FABRIC_BOOTSTRAP_SERVICE_ID" in platform, "should export X1_FABRIC_BOOTSTRAP_SERVICE_ID");
});

test("platform index exports five-plane runtime orchestrator", () => {
  assert.ok("FivePlaneRuntimeOrchestrator" in platform, "should export FivePlaneRuntimeOrchestrator class");
  assert.ok("registerFivePlaneRuntimeOrchestrator" in platform, "should export registerFivePlaneRuntimeOrchestrator");
});

test("platform index exports ai-operations runtime catalog", () => {
  assert.ok("aiOperationsRuntimeCatalog" in platform, "should export aiOperationsRuntimeCatalog");
});

test("platform index exports architecture namespace", () => {
  assert.ok("architecture" in platform, "should export architecture namespace");
  assert.ok(typeof platform.architecture === "object", "architecture should be an object");
});

test("platform index exports platform-mainline-bootstrap functions", () => {
  assert.ok("PLATFORM_MAINLINE_CAPABILITIES" in platform, "should export PLATFORM_MAINLINE_CAPABILITIES");
  assert.ok("listPlatformMainlineCapabilities" in platform, "should export listPlatformMainlineCapabilities");
  assert.ok("resolvePlatformMainlineCapability" in platform, "should export resolvePlatformMainlineCapability");
});

test("platform index exports platform-module-catalog functions", () => {
  assert.ok("PLATFORM_SURFACE_MANIFESTS" in platform, "should export PLATFORM_SURFACE_MANIFESTS");
  assert.ok("listPlatformSurfaceManifests" in platform, "should export listPlatformSurfaceManifests");
  assert.ok("resolvePlatformSurfaceManifest" in platform, "should export resolvePlatformSurfaceManifest");
  assert.ok("ARCHITECTURE_READINESS_RINGS" in platform, "should export ARCHITECTURE_READINESS_RINGS");
  assert.ok("listArchitectureReadinessRings" in platform, "should export listArchitectureReadinessRings");
  assert.ok("resolveArchitectureReadinessRing" in platform, "should export resolveArchitectureReadinessRing");
});

test("platform index exports interface-plane-bootstrap", () => {
  assert.ok("buildInterfacePlaneBootstrap" in platform, "should export buildInterfacePlaneBootstrap");
});

test("platform index exports webhook services", () => {
  assert.ok("WebhookIngressService" in platform, "should export WebhookIngressService");
  assert.ok("WebhookOutboxDispatchService" in platform, "should export WebhookOutboxDispatchService");
});

test("platform index exports model-gateway bootstrap", () => {
  assert.ok("buildModelGatewayBootstrap" in platform, "should export buildModelGatewayBootstrap");
});

test("platform index exports HarnessRuntimeService", () => {
  assert.ok("HarnessRuntimeService" in platform, "should export HarnessRuntimeService");
});

test("platform index exports PromptTemplateRegistryService", () => {
  assert.ok("PromptTemplateRegistryService" in platform, "should export PromptTemplateRegistryService");
});

test("platform index exports execution services", () => {
  assert.ok("ExecutionLeaseService" in platform, "should export ExecutionLeaseService");
  assert.ok("HaCoordinatorService" in platform, "should export HaCoordinatorService");
  assert.ok("TransitionService" in platform, "should export TransitionService");
  assert.ok("executeToolCall" in platform, "should export executeToolCall");
  assert.ok("resetToolRegistry" in platform, "should export resetToolRegistry");
});

test("platform index exports orchestration services", () => {
  assert.ok("HitlApprovalOrchestrationService" in platform, "should export HitlApprovalOrchestrationService");
  assert.ok("OapeflirLoopService" in platform, "should export OapeflirLoopService");
  assert.ok("TaskDecompositionService" in platform, "should export TaskDecompositionService");
});
