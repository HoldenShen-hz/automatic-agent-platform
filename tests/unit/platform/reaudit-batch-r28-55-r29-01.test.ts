import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createLearningArtifact, parseLearningArtifact } from "../../../src/platform/five-plane-orchestration/learn/learning-artifact-model.js";
import { parseLearningObject } from "../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("R28-55 gateway defaults include SSE connection and idle timeout guards", () => {
  const config = JSON.parse(readFileSync("config/gateways/default.json", "utf8"));

  assert.equal(config.sseEnabled, true);
  assert.equal(config.sseMaxConnections, 200);
  assert.equal(config.sseIdleTimeoutMs, 120000);
});

test("R28-59 bootstrap defaults no longer expose the deprecated production phase", () => {
  const config = JSON.parse(readFileSync("config/bootstrap/default.json", "utf8"));

  assert.equal(config.phase, "ring_1");
  assert.notEqual(config.phase, "phase_1a");
});

test("R28-60 coding domain elevates shell execution workflows", () => {
  const config = JSON.parse(readFileSync("config/domains/default.json", "utf8"));
  const codingDomain = config.domains.find((domain: { domainId: string }) => domain.domainId === "coding");

  assert.ok(codingDomain);
  assert.ok(codingDomain.capabilities.requiredTools.includes("shell_exec"));
  assert.equal(codingDomain.capabilities.securityLevel, "elevated");
});

test("R28-62 service registry topological sort throws on circular teardown graphs", () => {
  const registry = new ServiceRegistry();
  registry.register("alpha", {
    init: () => ({ ok: true }),
    dependsOn: ["beta"],
  });
  registry.register("beta", {
    init: () => ({ ok: true }),
    dependsOn: ["alpha"],
  });

  assert.throws(
    () => registry.topologicalSort(),
    /circular dependency detected/,
  );
});

test("R29-01 learning artifact creation always emits a valid sha256 checksum", async () => {
  const learningObject = parseLearningObject({
    learningObjectId: "learning_object_with_gz_123",
    learningType: "failure_pattern",
    title: "Checksum regression",
    summary: "Ensure artifact checksums stay valid hex.",
    confidence: 0.8,
    evidenceRefs: ["evidence://artifact/1"],
    sourceSignalIds: ["signal://artifact/1"],
    recommendation: "Keep hashing a stable source string.",
    createdAt: "2026-05-11T00:00:00.000Z",
  });

  const artifact = await createLearningArtifact(learningObject, "learning/test");
  const parsedArtifact = parseLearningArtifact(artifact);

  assert.match(parsedArtifact.checksum, /^[a-f0-9]{64}$/);
});
