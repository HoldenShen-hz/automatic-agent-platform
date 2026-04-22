import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAiOperationsRuntimeCatalog,
  buildAiOperationsStartupPlan,
  buildFivePlaneRuntimeCatalog,
  buildModelGatewayBootstrap,
  registerAiOperationsRuntimeCatalog,
  registerFivePlaneRuntimeOrchestrator,
  buildFivePlaneStartupPlan,
  buildInterfacePlaneBootstrap,
  HarnessRuntimeService,
  PromptTemplateRegistryService,
  registerPlatformSurfaceCatalog,
  WebhookIngressService,
} from "../../../src/platform/index.js";

test("platform root barrel exposes canonical cross-surface capabilities", () => {
  assert.equal(typeof registerPlatformSurfaceCatalog, "function");
  assert.equal(typeof buildAiOperationsRuntimeCatalog, "function");
  assert.equal(typeof registerAiOperationsRuntimeCatalog, "function");
  assert.equal(typeof buildAiOperationsStartupPlan, "function");
  assert.equal(typeof buildFivePlaneRuntimeCatalog, "function");
  assert.equal(typeof buildModelGatewayBootstrap, "function");
  assert.equal(typeof registerFivePlaneRuntimeOrchestrator, "function");
  assert.equal(typeof buildFivePlaneStartupPlan, "function");
  assert.equal(typeof buildInterfacePlaneBootstrap, "function");
  assert.equal(typeof WebhookIngressService, "function");
  assert.equal(typeof PromptTemplateRegistryService, "function");
  assert.equal(typeof HarnessRuntimeService, "function");
});
