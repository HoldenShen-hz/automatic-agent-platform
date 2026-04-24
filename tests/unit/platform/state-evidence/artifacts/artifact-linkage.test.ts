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

test("ArtifactLinkageService.listForArtifact returns empty array for unknown artifact", () => {
  const service = new ArtifactLinkageService();
  const links = service.listForArtifact("artifact:unknown");
  assert.equal(links.length, 0);
  assert.ok(Array.isArray(links));
});

test("ArtifactLinkageService.listForArtifact returns multiple links for same source", () => {
  const service = new ArtifactLinkageService();
  service.link("artifact:source", "artifact:target1", "derived_from");
  service.link("artifact:source", "artifact:target2", "depends_on");
  service.link("artifact:source", "artifact:target3", "uses");

  const links = service.listForArtifact("artifact:source");
  assert.equal(links.length, 3);
  assert.ok(links.every((l) => l.fromArtifactId === "artifact:source"));
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
  assert.equal(toB.length, 0);
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

test("ArtifactLinkageService.link generates unique linkIds for each call", () => {
  const service = new ArtifactLinkageService();
  const link1 = service.link("artifact:1", "artifact:2", "derived_from");
  const link2 = service.link("artifact:1", "artifact:2", "derived_from");
  const link3 = service.link("artifact:1", "artifact:2", "derived_from");

  assert.notEqual(link1.linkId, link2.linkId);
  assert.notEqual(link2.linkId, link3.linkId);
  assert.notEqual(link1.linkId, link3.linkId);
});

test("ArtifactLinkageService.link stores correct toRefId", () => {
  const service = new ArtifactLinkageService();
  const toRefId = "external-ref-12345";
  const link = service.link("artifact:x", toRefId, "attached_to");

  assert.equal(link.toRefId, toRefId);
});

test("ArtifactLinkageService.listForArtifact returns independent links for different sources", () => {
  const service = new ArtifactLinkageService();
  service.link("artifact:a", "artifact:t1", "derived_from");
  service.link("artifact:a", "artifact:t2", "uses");
  service.link("artifact:b", "artifact:t3", "depends_on");

  const linksA = service.listForArtifact("artifact:a");
  const linksB = service.listForArtifact("artifact:b");

  assert.equal(linksA.length, 2);
  assert.equal(linksB.length, 1);
  assert.ok(linksA.every((l) => l.fromArtifactId === "artifact:a"));
  assert.ok(linksB.every((l) => l.fromArtifactId === "artifact:b"));
});

test("ArtifactLinkageService can link multiple artifacts to the same target", () => {
  const service = new ArtifactLinkageService();
  service.link("artifact:source1", "artifact:target", "derived_from");
  service.link("artifact:source2", "artifact:target", "depends_on");
  service.link("artifact:source3", "artifact:target", "uses");

  const fromSource1 = service.listForArtifact("artifact:source1");
  const fromSource2 = service.listForArtifact("artifact:source2");
  const fromSource3 = service.listForArtifact("artifact:source3");

  assert.equal(fromSource1.length, 1);
  assert.equal(fromSource2.length, 1);
  assert.equal(fromSource3.length, 1);
  assert.equal(fromSource1[0]?.toRefId, "artifact:target");
  assert.equal(fromSource2[0]?.toRefId, "artifact:target");
  assert.equal(fromSource3[0]?.toRefId, "artifact:target");
});

test("ArtifactLinkageService.link allows artifact to link to itself", () => {
  const service = new ArtifactLinkageService();
  const link = service.link("artifact:self", "artifact:self", "replaces");

  assert.equal(link.fromArtifactId, "artifact:self");
  assert.equal(link.toRefId, "artifact:self");
});

test("ArtifactLinkageService.listForArtifact returns a new array each call", () => {
  const service = new ArtifactLinkageService();
  service.link("artifact:x", "artifact:y", "derived_from");

  const firstCall = service.listForArtifact("artifact:x");
  const secondCall = service.listForArtifact("artifact:x");

  assert.notEqual(firstCall, secondCall);
  assert.deepEqual(firstCall, secondCall);
});

test("ArtifactLinkageService.link returns the stored link directly", () => {
  const service = new ArtifactLinkageService();
  const link = service.link("artifact:1", "artifact:2", "derived_from");

  const retrieved = service.listForArtifact("artifact:1");
  assert.equal(retrieved[0]?.linkId, link.linkId);
});

test("ArtifactLinkageService.listForArtifact on empty service returns empty array", () => {
  const service = new ArtifactLinkageService();
  const links = service.listForArtifact("artifact:any");

  assert.equal(links.length, 0);
});

test("ArtifactLinkageService supports mixed relation types in same service", () => {
  const service = new ArtifactLinkageService();
  service.link("artifact:mixed", "artifact:1", "derived_from");
  service.link("artifact:mixed", "artifact:2", "replaces");
  service.link("artifact:mixed", "artifact:3", "depends_on");
  service.link("artifact:mixed", "artifact:4", "tested_by");
  service.link("artifact:mixed", "artifact:5", "uses");

  const links = service.listForArtifact("artifact:mixed");
  const relations = links.map((l) => l.relation);

  assert.equal(links.length, 5);
  assert.ok(relations.includes("derived_from"));
  assert.ok(relations.includes("replaces"));
  assert.ok(relations.includes("depends_on"));
  assert.ok(relations.includes("tested_by"));
  assert.ok(relations.includes("uses"));
});

test("ArtifactLinkageService.link with empty string IDs is valid", () => {
  const service = new ArtifactLinkageService();
  const link = service.link("", "", "attached_to");

  assert.equal(link.fromArtifactId, "");
  assert.equal(link.toRefId, "");
});

test("ArtifactLinkageService.listForArtifact filters by exact fromArtifactId match", () => {
  const service = new ArtifactLinkageService();
  service.link("artifact:abc", "artifact:x", "derived_from");
  service.link("artifact:abcd", "artifact:x", "uses");
  service.link("artifact:abcde", "artifact:x", "depends_on");

  const links = service.listForArtifact("artifact:abc");

  assert.equal(links.length, 1);
  assert.equal(links[0]?.fromArtifactId, "artifact:abc");
});

test("ArtifactLinkageService stores all links independently", () => {
  const service = new ArtifactLinkageService();
  const link1 = service.link("artifact:1", "artifact:a", "derived_from");
  const link2 = service.link("artifact:2", "artifact:b", "depends_on");
  const link3 = service.link("artifact:3", "artifact:c", "uses");

  const allLinks = [
    ...service.listForArtifact("artifact:1"),
    ...service.listForArtifact("artifact:2"),
    ...service.listForArtifact("artifact:3"),
  ];

  assert.equal(allLinks.length, 3);
  assert.ok(allLinks.some((l) => l.linkId === link1.linkId));
  assert.ok(allLinks.some((l) => l.linkId === link2.linkId));
  assert.ok(allLinks.some((l) => l.linkId === link3.linkId));
});

test("ArtifactLinkageService.listForArtifact returns links with all fields populated", () => {
  const service = new ArtifactLinkageService();
  const fromId = "artifact:from";
  const toId = "artifact:to";
  const relation: ArtifactLinkExtended["relation"] = "summarizes";

  service.link(fromId, toId, relation);
  const links = service.listForArtifact(fromId);

  assert.equal(links.length, 1);
  const link = links[0]!;
  assert.ok(link.linkId.length > 0);
  assert.equal(link.fromArtifactId, fromId);
  assert.equal(link.toRefId, toId);
  assert.equal(link.relation, relation);
});
