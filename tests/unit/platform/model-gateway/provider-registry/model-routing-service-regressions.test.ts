import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MODEL_METADATA_REGISTRY,
  type ModelMetadataRegistry,
} from "../../../../../src/platform/five-plane-control-plane/config-center/model-metadata-registry.js";
import { ModelRoutingService } from "../../../../../src/platform/model-gateway/provider-registry/model-routing-service.js";

function buildRegistry(): ModelMetadataRegistry {
  return JSON.parse(JSON.stringify(DEFAULT_MODEL_METADATA_REGISTRY)) as ModelMetadataRegistry;
}

test("ModelRoutingService prefers higher maxOutputTokens when input cost ties", () => {
  const registry = buildRegistry();
  registry.profiles["balanced"] = {
    ...registry.profiles["balanced"]!,
    pricing: {
      inputPer1kUsd: 0.4,
      outputPer1kUsd: registry.profiles["balanced"]!.pricing.outputPer1kUsd,
    },
    maxOutputTokens: 4096,
  };
  registry.profiles["balanced-large"] = {
    ...registry.profiles["balanced"]!,
    modelId: "balanced-large-model",
    maxOutputTokens: 8192,
    pricing: {
      inputPer1kUsd: 0.4,
      outputPer1kUsd: registry.profiles["balanced"]!.pricing.outputPer1kUsd,
    },
    metadataSource: "local_override",
  };

  const service = new ModelRoutingService({ registry });
  const result = service.route({
    routeClass: "writing",
    riskLevel: "medium",
  });

  assert.equal(result.profileName, "balanced-large");
  assert.equal(result.profile.maxOutputTokens, 8192);
});
