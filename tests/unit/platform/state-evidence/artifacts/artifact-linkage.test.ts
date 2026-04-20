import assert from "node:assert/strict";
import test from "node:test";

import { ArtifactLinkageService } from "../../../../../src/platform/state-evidence/artifacts/artifact-linkage.js";
import type { ArtifactLinkExtended } from "../../../../../src/platform/state-evidence/artifacts/artifact-model.js";

test("ArtifactLinkageService.link creates a link with correct fields", () => {
  const service = new ArtifactLinkageService();
  const link = service.link("artifact:1", "artifact:2", "derived_from");

  assert.ok(link.linkId.startsWith("artifact_link_"));
  assert.equal(link.fromArtifactId, "artifact:1");
  assert.equal(link.toRefId, "artifact:2");
  assert.equal(link.relation, "derived_from");
});

test("ArtifactLinkageService.link stores the link", () => {
  const service = new ArtifactLinkageService();
  const link = service.link("artifact:a", "artifact:b", "depends_on");

  const retrieved = service.listForArtifact("artifact:a");
  assert.equal(retrieved.length, 1);
  assert.equal(retrieved[0]?.linkId, link.linkId);
  assert.equal(retrieved[0]?.relation, "depends_on");
});

test("ArtifactLinkageService.listForArtifact returns empty for unknown artifact", () => {
  const service = new ArtifactLinkageService();
  const links = service.listForArtifact("artifact:unknown");
  assert.equal(links.length, 0);
});

test("ArtifactLinkageService.listForArtifact returns multiple links for same source", () => {
  const service = new ArtifactLinkageService();
  service.link("artifact:source", "artifact:target1", "derived_from");
  service.link("artifact:source", "artifact:target2", "depends_on");
  service.link("artifact:source", "artifact:target3", "uses");

  const links = service.listForArtifact("artifact:source");
  assert.equal(links.length, 3);
  assert.ok(links.every(l => l.fromArtifactId === "artifact:source"));
});

test("ArtifactLinkageService.listForArtifact does not return links to artifact", () => {
  const service = new ArtifactLinkageService();
  service.link("artifact:a", "artifact:b", "derived_from");
  service.link("artifact:c", "artifact:b", "uses");

  const fromA = service.listForArtifact("artifact:a");
  const fromC = service.listForArtifact("artifact:c");
  const toB = service.listForArtifact("artifact:b");

  assert.equal(fromA.length, 1);
  assert.equal(fromC.length, 1);
  assert.equal(toB.length, 0); // Lists by fromArtifactId, not toRefId
});

test("ArtifactLinkageService supports all relation types", () => {
  const service = new ArtifactLinkageService();
  const relations: ArtifactLinkExtended["relation"][] = [
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
    const link = service.link("artifact:1", "artifact:2", relation);
    assert.equal(link.relation, relation);
  }
});
