import assert from "node:assert/strict";
import test from "node:test";

import * as agentLifecycle from "../../../src/ops-maturity/agent-lifecycle/index.js";
import * as capacityPlanner from "../../../src/ops-maturity/capacity-planner/index.js";
import * as complianceReporter from "../../../src/ops-maturity/compliance-reporter/index.js";
import * as costOptimizer from "../../../src/ops-maturity/cost-optimizer/index.js";
import * as driftDetection from "../../../src/ops-maturity/drift-detection/index.js";
import * as edgeRuntime from "../../../src/ops-maturity/edge-runtime/index.js";
import * as emergency from "../../../src/ops-maturity/emergency/index.js";
import * as explainability from "../../../src/ops-maturity/explainability/index.js";
import * as monitoring from "../../../src/ops-maturity/monitoring/index.js";
import * as multimodal from "../../../src/ops-maturity/multimodal/index.js";
import * as opsMaturityRoot from "../../../src/ops-maturity/index.js";
import * as platformOpsAgent from "../../../src/ops-maturity/platform-ops-agent/index.js";
import * as workflowDebugger from "../../../src/ops-maturity/workflow-debugger/index.js";
import {
  listOpsMaturityCapabilityBaselines,
  resolveOpsMaturityCapabilityBaseline,
} from "../../../src/ops-maturity/ops-maturity-baseline-catalog.js";

test("ops-maturity baseline catalog covers the maturity capability set", () => {
  const baselines = listOpsMaturityCapabilityBaselines();
  assert.equal(baselines.length, 12);
  assert.ok(resolveOpsMaturityCapabilityBaseline("platform-ops-agent").baselineServices.includes("PlatformOpsAgentService"));
  assert.ok(resolveOpsMaturityCapabilityBaseline("workflow-debugger").baselineServices.includes("TimeTravelDebugService"));
});

test("ops-maturity baseline services resolve from canonical submodule and root exports", () => {
  const rootExports = opsMaturityRoot as Record<string, unknown>;
  const submodulesByEntryModule: Record<string, Record<string, unknown>> = {
    "src/ops-maturity/agent-lifecycle/index.ts": agentLifecycle as Record<string, unknown>,
    "src/ops-maturity/capacity-planner/index.ts": capacityPlanner as Record<string, unknown>,
    "src/ops-maturity/compliance-reporter/index.ts": complianceReporter as Record<string, unknown>,
    "src/ops-maturity/cost-optimizer/index.ts": costOptimizer as Record<string, unknown>,
    "src/ops-maturity/drift-detection/index.ts": driftDetection as Record<string, unknown>,
    "src/ops-maturity/edge-runtime/index.ts": edgeRuntime as Record<string, unknown>,
    "src/ops-maturity/emergency/index.ts": emergency as Record<string, unknown>,
    "src/ops-maturity/explainability/index.ts": explainability as Record<string, unknown>,
    "src/ops-maturity/monitoring/index.ts": monitoring as Record<string, unknown>,
    "src/ops-maturity/multimodal/index.ts": multimodal as Record<string, unknown>,
    "src/ops-maturity/platform-ops-agent/index.ts": platformOpsAgent as Record<string, unknown>,
    "src/ops-maturity/workflow-debugger/index.ts": workflowDebugger as Record<string, unknown>,
  };

  for (const baseline of listOpsMaturityCapabilityBaselines()) {
    const submodule = submodulesByEntryModule[baseline.entryModule];
    assert.ok(submodule, `missing submodule mapping for ${baseline.entryModule}`);
    for (const serviceName of baseline.baselineServices) {
      assert.notEqual(rootExports[serviceName], undefined, `root export missing ${serviceName}`);
      assert.notEqual(submodule[serviceName], undefined, `submodule export missing ${serviceName}`);
    }
  }
});
