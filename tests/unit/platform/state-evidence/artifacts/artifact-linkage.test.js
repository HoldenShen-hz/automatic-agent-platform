import assert from "node:assert/strict";
import test from "node:test";

import { ArtifactLinkageService } from "../../../../../../src/platform/state-evidence/artifacts/artifact-linkage.js";

test("ArtifactLinkageService can be instantiated", () => {
  const service = new ArtifactLinkageService();
  assert.ok(service != null);
});

test("link creates a new link with generated linkId", () => {
  const service = new ArtifactLinkageService();
  const link = service.link("artifact_1", "artifact_2", "derived_from");
  assert.ok(link.linkId.startsWith("artifact_link_"), `Expected linkId to start with artifact_link_, got: ${link.linkId}`);
  assert.equal(link.fromArtifactId, "artifact_1");
  assert.equal(link.toRefId, "artifact_2");
  assert.equal(link.relation, "derived_from");
});

test("link accepts all valid relation types", () => {
  const service = new ArtifactLinkageService();
  const relations = [
    "derived_from",
    "replaces",
    "depends_on",
    "tested_by",
    "reviewed_by",
    "uses",
    "published_from",
    "summarizes",
    "attached_to",
  ];
  for (const relation of relations) {
    const link = service.link("artifact_1", "artifact_2", relation);
    assert.equal(link.relation, relation);
  }
});

test("listForArtifact returns empty array when no links exist", () => {
  const service = new ArtifactLinkageService();
  const results = service.listForArtifact("artifact_nonexistent");
  assert.deepEqual(results, []);
});

test("listForArtifact returns links where fromArtifactId matches", () => {
  const service = new ArtifactLinkageService();
  service.link("artifact_1", "artifact_2", "derived_from");
  service.link("artifact_1", "artifact_3", "replaces");
  service.link("artifact_2", "artifact_3", "depends_on");
  const results = service.listForArtifact("artifact_1");
  assert.equal(results.length, 2);
  assert.ok(results.every((link) => link.fromArtifactId === "artifact_1"));
});

test("listForArtifact does not return links with different fromArtifactId", () => {
  const service = new ArtifactLinkageService();
  service.link("artifact_1", "artifact_2", "derived_from");
  service.link("artifact_2", "artifact_3", "depends_on");
  const results = service.listForArtifact("artifact_1");
  assert.equal(results.length, 1);
  assert.equal(results[0].fromArtifactId, "artifact_1");
  assert.equal(results[0].toRefId, "artifact_2");
});

test("link returns ArtifactLinkExtended schema compatible object", () => {
  const service = new ArtifactLinkageService();
  const link = service.link("artifact_a", "artifact_b", "uses");
  assert.ok("linkId" in link);
  assert.ok("fromArtifactId" in link);
  assert.ok("toRefId" in link);
  assert.ok("relation" in link);
});

test("multiple links to same target are all stored", () => {
  const service = new ArtifactLinkageService();
  service.link("artifact_1", "artifact_2", "derived_from");
  service.link("artifact_1", "artifact_2", "replaces");
  const results = service.listForArtifact("artifact_1");
  assert.equal(results.length, 2);
});