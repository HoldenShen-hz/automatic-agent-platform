import assert from "node:assert/strict";
import test from "node:test";

import { JudgeProviderRegistryService } from "../../../../../src/platform/prompt-engine/eval/judge-provider-registry-service.js";

test("JudgeProviderRegistryService registers defaults and selects isolated judge candidates", () => {
  const service = new JudgeProviderRegistryService();
  service.registerDefaults();

  const ready = service.listDescriptors("ready");
  assert.equal(ready.length, 3);
  assert.equal(ready[0]?.providerId, "judge.openai.gpt-5.4-mini");

  const isolated = service.selectDescriptor({
    capability: "llm_judge",
    candidateProviderFamily: "openai",
    maxCostUsd: 0.2,
    requireIsolation: true,
  });
  assert.ok(isolated);
  assert.notEqual(isolated?.providerFamily, "openai");

  const sameFamilyAllowed = service.selectDescriptor({
    capability: "llm_judge",
    candidateProviderFamily: "openai",
    maxCostUsd: 0.2,
    requireIsolation: false,
  });
  assert.ok(sameFamilyAllowed);
});
