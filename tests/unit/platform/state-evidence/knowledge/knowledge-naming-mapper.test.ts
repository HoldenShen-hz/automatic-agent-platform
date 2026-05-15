/**
 * Unit tests for knowledge-naming-mapper
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  // Trust level conversions
  toDocTrustLevel,
  toCodeTrustLevel,
  isTrustLevelAtOrAbove,
  TRUST_LEVEL_TO_DOC,
  TRUST_LEVEL_TO_CODE,
  // Memory layer conversions
  toDocMemoryLayer,
  toCodeMemoryLayer,
  isMemoryLayerAtOrAbove,
  MEMORY_LAYER_TO_DOC,
  MEMORY_LAYER_TO_CODE,
  getMemoryLayerDescription,
  getTrustLevelDescription,
} from "../../../../../src/platform/five-plane-state-evidence/knowledge/governance/knowledge-naming-mapper.js";

test("toDocTrustLevel converts code trust levels to documentation trust levels", () => {
  assert.equal(toDocTrustLevel("trusted"), "verified");
  assert.equal(toDocTrustLevel("external"), "unverified");
  assert.equal(toDocTrustLevel("untrusted"), "deprecated");
});

test("toCodeTrustLevel converts documentation trust levels to code trust levels", () => {
  assert.equal(toCodeTrustLevel("verified"), "trusted");
  assert.equal(toCodeTrustLevel("unverified"), "external");
  assert.equal(toCodeTrustLevel("deprecated"), "untrusted");
});

test("TRUST_LEVEL_TO_DOC mapping is complete and bidirectional", () => {
  for (const code of ["trusted", "external", "untrusted"] as const) {
    const doc = TRUST_LEVEL_TO_DOC[code];
    assert.ok(doc);
    assert.equal(toCodeTrustLevel(doc), code);
  }
});

test("TRUST_LEVEL_TO_CODE mapping is complete and bidirectional", () => {
  for (const doc of ["verified", "unverified", "deprecated"] as const) {
    const code = TRUST_LEVEL_TO_CODE[doc];
    assert.ok(code);
    assert.equal(toDocTrustLevel(code), doc);
  }
});

test("isTrustLevelAtOrAbove returns true when level is at or above minimum", () => {
  // Using code levels
  assert.equal(isTrustLevelAtOrAbove("trusted", "trusted"), true);
  assert.equal(isTrustLevelAtOrAbove("trusted", "external"), true);
  assert.equal(isTrustLevelAtOrAbove("trusted", "untrusted"), true);
  assert.equal(isTrustLevelAtOrAbove("external", "trusted"), false);
  assert.equal(isTrustLevelAtOrAbove("external", "external"), true);
  assert.equal(isTrustLevelAtOrAbove("external", "untrusted"), true);
  assert.equal(isTrustLevelAtOrAbove("untrusted", "trusted"), false);
  assert.equal(isTrustLevelAtOrAbove("untrusted", "external"), false);
  assert.equal(isTrustLevelAtOrAbove("untrusted", "untrusted"), true);
});

test("isTrustLevelAtOrAbove works with documentation trust levels", () => {
  assert.equal(isTrustLevelAtOrAbove("verified", "verified"), true);
  assert.equal(isTrustLevelAtOrAbove("verified", "unverified"), true);
  assert.equal(isTrustLevelAtOrAbove("verified", "deprecated"), true);
  assert.equal(isTrustLevelAtOrAbove("deprecated", "verified"), false);
});

test("isTrustLevelAtOrAbove is symmetric between code and doc levels", () => {
  assert.equal(isTrustLevelAtOrAbove("trusted", "verified"), true);
  assert.equal(isTrustLevelAtOrAbove("verified", "trusted"), true);
  assert.equal(isTrustLevelAtOrAbove("untrusted", "deprecated"), true);
  assert.equal(isTrustLevelAtOrAbove("deprecated", "untrusted"), true);
});

test("toDocMemoryLayer converts code memory layers to documentation memory layers", () => {
  assert.equal(toDocMemoryLayer("layer_3"), "working");
  assert.equal(toDocMemoryLayer("layer_4"), "episodic");
  assert.equal(toDocMemoryLayer("layer_5"), "semantic");
});

test("toCodeMemoryLayer converts documentation memory layers to code memory layers", () => {
  assert.equal(toCodeMemoryLayer("working"), "layer_3");
  assert.equal(toCodeMemoryLayer("episodic"), "layer_4");
  assert.equal(toCodeMemoryLayer("semantic"), "layer_5");
});

test("MEMORY_LAYER_TO_DOC mapping is complete and bidirectional", () => {
  for (const code of ["layer_3", "layer_4", "layer_5"] as const) {
    const doc = MEMORY_LAYER_TO_DOC[code];
    assert.ok(doc);
    assert.equal(toCodeMemoryLayer(doc), code);
  }
});

test("MEMORY_LAYER_TO_CODE mapping is complete and bidirectional", () => {
  for (const doc of ["working", "episodic", "semantic"] as const) {
    const code = MEMORY_LAYER_TO_CODE[doc];
    assert.ok(code);
    assert.equal(toDocMemoryLayer(code), doc);
  }
});

test("isMemoryLayerAtOrAbove returns true when layer is at or above minimum", () => {
  // Using code layers
  assert.equal(isMemoryLayerAtOrAbove("layer_3", "layer_3"), true);
  assert.equal(isMemoryLayerAtOrAbove("layer_3", "layer_4"), false);
  assert.equal(isMemoryLayerAtOrAbove("layer_3", "layer_5"), false);
  assert.equal(isMemoryLayerAtOrAbove("layer_4", "layer_3"), true);
  assert.equal(isMemoryLayerAtOrAbove("layer_4", "layer_4"), true);
  assert.equal(isMemoryLayerAtOrAbove("layer_4", "layer_5"), false);
  assert.equal(isMemoryLayerAtOrAbove("layer_5", "layer_3"), true);
  assert.equal(isMemoryLayerAtOrAbove("layer_5", "layer_4"), true);
  assert.equal(isMemoryLayerAtOrAbove("layer_5", "layer_5"), true);
});

test("isMemoryLayerAtOrAbove works with documentation memory layers", () => {
  assert.equal(isMemoryLayerAtOrAbove("working", "working"), true);
  assert.equal(isMemoryLayerAtOrAbove("working", "episodic"), false);
  assert.equal(isMemoryLayerAtOrAbove("semantic", "working"), true);
});

test("isMemoryLayerAtOrAbove is symmetric between code and doc layers", () => {
  assert.equal(isMemoryLayerAtOrAbove("layer_3", "working"), true);
  assert.equal(isMemoryLayerAtOrAbove("working", "layer_3"), true);
  assert.equal(isMemoryLayerAtOrAbove("layer_5", "semantic"), true);
  assert.equal(isMemoryLayerAtOrAbove("semantic", "layer_5"), true);
});

test("getMemoryLayerDescription returns correct descriptions", () => {
  assert.ok(getMemoryLayerDescription("working").includes("short-term"));
  assert.ok(getMemoryLayerDescription("episodic").includes("medium-term"));
  assert.ok(getMemoryLayerDescription("semantic").includes("long-term"));
});

test("getTrustLevelDescription returns correct descriptions", () => {
  assert.ok(getTrustLevelDescription("verified").includes("High-confidence"));
  assert.ok(getTrustLevelDescription("unverified").includes("not yet verified"));
  assert.ok(getTrustLevelDescription("deprecated").includes("unreliable"));
});
