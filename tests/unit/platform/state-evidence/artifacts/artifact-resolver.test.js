import assert from "node:assert/strict";
import test from "node:test";

import { ArtifactResolver } from "../../../../../../src/platform/state-evidence/artifacts/artifact-resolver.js";

test("ArtifactResolver can be instantiated", () => {
  const resolver = new ArtifactResolver();
  assert.ok(resolver != null);
});

test("buildBundle creates bundle with unique artifactRefs", () => {
  const resolver = new ArtifactResolver();
  const result = resolver.buildBundle(["a", "b", "a"]);
  assert.deepEqual(result.artifactRefs, ["a", "b"]);
});

test("buildBundle deduplicates primaryRefs", () => {
  const resolver = new ArtifactResolver();
  const result = resolver.buildBundle(["a", "b"], ["b", "c", "b"]);
  assert.deepEqual(result.primaryRefs, ["b", "c"]);
});

test("buildBundle defaults primaryRefs to artifactRefs when empty", () => {
  const resolver = new ArtifactResolver();
  const result = resolver.buildBundle(["a", "b", "c"]);
  assert.deepEqual(result.primaryRefs, ["a", "b", "c"]);
});

test("buildBundle uses primaryRefs when provided", () => {
  const resolver = new ArtifactResolver();
  const result = resolver.buildBundle(["a", "b", "c"], ["a"]);
  assert.deepEqual(result.primaryRefs, ["a"]);
});

test("resolveRef finds artifact by id", () => {
  const resolver = new ArtifactResolver();
  const records = [{ artifactId: "artifact_1" }, { artifactId: "artifact_2" }];
  const result = resolver.resolveRef("artifact_1", records);
  assert.ok(result);
  assert.equal(result.artifactId, "artifact_1");
});

test("resolveRef returns null for non-existent artifact", () => {
  const resolver = new ArtifactResolver();
  const records = [{ artifactId: "artifact_1" }];
  const result = resolver.resolveRef("artifact_nonexistent", records);
  assert.equal(result, null);
});

test("resolveRef handles artifact: prefix", () => {
  const resolver = new ArtifactResolver();
  const records = [{ artifactId: "artifact_1" }];
  const result = resolver.resolveRef("artifact:artifact_1", records);
  assert.ok(result);
  assert.equal(result.artifactId, "artifact_1");
});

test("resolveRef returns null for empty records array", () => {
  const resolver = new ArtifactResolver();
  const result = resolver.resolveRef("artifact_1", []);
  assert.equal(result, null);
});

test("buildBundle handles empty input", () => {
  const resolver = new ArtifactResolver();
  const result = resolver.buildBundle([]);
  assert.deepEqual(result.artifactRefs, []);
  assert.deepEqual(result.primaryRefs, []);
});

test("buildBundle preserves order of first occurrence", () => {
  const resolver = new ArtifactResolver();
  const result = resolver.buildBundle(["z", "a", "m", "a", "z"]);
  assert.deepEqual(result.artifactRefs, ["z", "a", "m"]);
});