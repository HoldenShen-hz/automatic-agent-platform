import assert from "node:assert/strict";
import test from "node:test";

import { ArtifactResolver } from "../../../../../src/platform/state-evidence/artifacts/artifact-resolver.js";

// Manual mock record factory to avoid external dependencies
function makeRecord(artifactId: string): { artifactId: string } {
  return { artifactId };
}

test("ArtifactResolver is instantiable", () => {
  const resolver = new ArtifactResolver();
  assert.ok(resolver instanceof ArtifactResolver);
});

// buildBundle tests

test("buildBundle returns empty arrays when given empty inputs", () => {
  const resolver = new ArtifactResolver();
  const bundle = resolver.buildBundle([], []);
  assert.deepEqual(bundle.artifactRefs, []);
  assert.deepEqual(bundle.primaryRefs, []);
});

test("buildBundle returns unique artifactRefs only when primaryRefs is empty", () => {
  const resolver = new ArtifactResolver();
  const bundle = resolver.buildBundle(["a1", "a2", "a1"], []);
  assert.deepEqual(bundle.artifactRefs, ["a1", "a2"]);
  assert.deepEqual(bundle.primaryRefs, ["a1", "a2"]);
});

test("buildBundle uses artifactRefs as primaryRefs when primaryRefs is empty string array", () => {
  const resolver = new ArtifactResolver();
  const bundle = resolver.buildBundle(["ref1", "ref2"], []);
  assert.deepEqual(bundle.primaryRefs, ["ref1", "ref2"]);
});

test("buildBundle returns only artifactRefs when primaryRefs is not provided", () => {
  const resolver = new ArtifactResolver();
  const bundle = resolver.buildBundle(["artifact:1", "artifact:2"]);
  assert.deepEqual(bundle.artifactRefs, ["artifact:1", "artifact:2"]);
  assert.deepEqual(bundle.primaryRefs, ["artifact:1", "artifact:2"]);
});

test("buildBundle deduplicates artifactRefs", () => {
  const resolver = new ArtifactResolver();
  const bundle = resolver.buildBundle(["a", "b", "a", "c", "b"], []);
  assert.deepEqual(bundle.artifactRefs, ["a", "b", "c"]);
});

test("buildBundle deduplicates primaryRefs", () => {
  const resolver = new ArtifactResolver();
  const bundle = resolver.buildBundle(["a1"], ["p1", "p2", "p1"]);
  assert.deepEqual(bundle.artifactRefs, ["a1"]);
  assert.deepEqual(bundle.primaryRefs, ["p1", "p2"]);
});

test("buildBundle preserves order of first occurrence for artifactRefs", () => {
  const resolver = new ArtifactResolver();
  const bundle = resolver.buildBundle(["z", "a", "z", "m", "a"], []);
  assert.deepEqual(bundle.artifactRefs, ["z", "a", "m"]);
});

test("buildBundle preserves order of first occurrence for primaryRefs", () => {
  const resolver = new ArtifactResolver();
  const bundle = resolver.buildBundle(["a1"], ["z", "a", "z", "m", "a"]);
  assert.deepEqual(bundle.primaryRefs, ["z", "a", "m"]);
});

test("buildBundle returns separate artifactRefs and primaryRefs", () => {
  const resolver = new ArtifactResolver();
  const bundle = resolver.buildBundle(["art1", "art2"], ["prim1", "prim2"]);
  assert.deepEqual(bundle.artifactRefs, ["art1", "art2"]);
  assert.deepEqual(bundle.primaryRefs, ["prim1", "prim2"]);
});

test("buildBundle handles single artifactRef", () => {
  const resolver = new ArtifactResolver();
  const bundle = resolver.buildBundle(["single"]);
  assert.deepEqual(bundle.artifactRefs, ["single"]);
  assert.deepEqual(bundle.primaryRefs, ["single"]);
});

// resolveRef tests

test("resolveRef returns null when records is empty", () => {
  const resolver = new ArtifactResolver();
  const result = resolver.resolveRef("artifact:1", []);
  assert.equal(result, null);
});

test("resolveRef returns null when artifact is not found", () => {
  const resolver = new ArtifactResolver();
  const records = [makeRecord("found")];
  const result = resolver.resolveRef("artifact:missing", records);
  assert.equal(result, null);
});

test("resolveRef finds record when ref has 'artifact:' prefix and record has raw id", () => {
  const resolver = new ArtifactResolver();
  // When ref has "artifact:" prefix and record has raw id, strip prefix to match
  const records = [makeRecord("123"), makeRecord("456")];
  const result = resolver.resolveRef("artifact:123", records);
  assert.ok(result !== null);
  assert.equal(result?.artifactId, "123");
});

test("resolveRef returns first match when duplicate artifactIds exist", () => {
  const resolver = new ArtifactResolver();
  const records = [makeRecord("dup"), makeRecord("dup")];
  const result = resolver.resolveRef("artifact:dup", records);
  assert.ok(result !== null);
  assert.equal(result?.artifactId, "dup");
});

test("resolveRef handles artifactRef without 'artifact:' prefix", () => {
  const resolver = new ArtifactResolver();
  const records = [makeRecord("simple-id")];
  const result = resolver.resolveRef("simple-id", records);
  assert.ok(result !== null);
  assert.equal(result?.artifactId, "simple-id");
});

test("resolveRef returns null for non-matching ref", () => {
  const resolver = new ArtifactResolver();
  const records = [makeRecord("abc"), makeRecord("def")];
  const result = resolver.resolveRef("artifact:xyz", records);
  assert.equal(result, null);
});

test("resolveRef handles empty string ref with matching empty artifactId", () => {
  const resolver = new ArtifactResolver();
  const records = [makeRecord("")];
  const result = resolver.resolveRef("", records);
  assert.ok(result !== null);
  assert.equal(result?.artifactId, "");
});

test("resolveRef returns null when ref has 'artifact:' prefix but no record matches", () => {
  const resolver = new ArtifactResolver();
  // Records have different artifactIds, none match " " after stripping prefix
  const records = [makeRecord("abc"), makeRecord("def")];
  const result = resolver.resolveRef("artifact: ", records);
  assert.equal(result, null);
});
