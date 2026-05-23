import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlatformStartupTargets,
  getPlatformAppManifestByKind,
  listPlatformAppKinds,
  listPlatformApps,
  resolvePlatformAppManifest,
  resolvePlatformStartupTarget,
} from "../../../src/apps/index.js";
import type {
  PlatformAppKind,
  PlatformStartupTargetKind,
} from "../../../src/platform-architecture-types.js";

test("listPlatformAppKinds returns correct order: api, console, worker", () => {
  const kinds = listPlatformAppKinds();
  assert.deepEqual(kinds, ["api", "console", "worker"]);
});

test("getPlatformAppManifestByKind works with each valid kind", () => {
  const api = getPlatformAppManifestByKind("api");
  assert.equal(api.kind, "api");

  const console = getPlatformAppManifestByKind("console");
  assert.equal(console.kind, "console");

  const worker = getPlatformAppManifestByKind("worker");
  assert.equal(worker.kind, "worker");
});

test("resolvePlatformAppManifest with empty string returns null", () => {
  const manifest = resolvePlatformAppManifest("");
  assert.equal(manifest, null);
});

test("resolvePlatformAppManifest with whitespace returns null", () => {
  const manifest = resolvePlatformAppManifest("   ");
  assert.equal(manifest, null);
});

test("getPlatformAppManifestByKind error message is descriptive", () => {
  try {
    getPlatformAppManifestByKind("invalid-kind" as unknown as PlatformAppKind);
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("invalid-kind"));
    assert.ok(err.message.includes("Unknown platform app kind"));
  }
});

test("resolvePlatformStartupTarget error message is descriptive", () => {
  try {
    resolvePlatformStartupTarget("invalid-target" as unknown as PlatformStartupTargetKind);
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("invalid-target"));
    assert.ok(err.message.includes("Unknown platform startup target"));
  }
});

test("listPlatformApps returns same reference each call", () => {
  const apps1 = listPlatformApps();
  const apps2 = listPlatformApps();
  assert.ok(apps1 === apps2);
});

test("listPlatformAppKinds returns different reference each call (map creates new array)", () => {
  const kinds1 = listPlatformAppKinds();
  const kinds2 = listPlatformAppKinds();
  assert.ok(kinds1 !== kinds2);
  assert.deepEqual(kinds1, kinds2);
});

test("resolvePlatformAppManifest matches by partial appId prefix", () => {
  const manifest = resolvePlatformAppManifest("automatic-agent");
  assert.equal(manifest, null);
});

test("all startup targets have valid targetKind", () => {
  const targets = buildPlatformStartupTargets();

  for (const target of targets) {
    assert.ok(
      target.targetKind === "summary" ||
        target.targetKind === "demo" ||
        target.targetKind === "api" ||
        target.targetKind === "console" ||
        target.targetKind === "worker"
    );
  }
});

test("app startup targets have non-null appManifest", () => {
  const targets = buildPlatformStartupTargets();
  const appTargets = targets.filter(
    (t) => t.targetKind === "api" || t.targetKind === "console" || t.targetKind === "worker"
  );

  for (const target of appTargets) {
    assert.ok(target.appManifest != null);
  }
});

test("non-app startup targets have null appManifest", () => {
  const targets = buildPlatformStartupTargets();
  const nonAppTargets = targets.filter(
    (t) => t.targetKind === "summary" || t.targetKind === "demo"
  );

  for (const target of nonAppTargets) {
    assert.equal(target.appManifest, null);
  }
});

test("demo target has platform and apps in requiredLayers", () => {
  const targets = buildPlatformStartupTargets();
  const demoTarget = targets.find((t) => t.targetKind === "demo");

  assert.ok(demoTarget != null);
  assert.ok(demoTarget.requiredLayers.includes("platform"));
  assert.ok(demoTarget.requiredLayers.includes("apps"));
});

test("each startup target has rootEntryModule set to src/index.ts", () => {
  const targets = buildPlatformStartupTargets();

  for (const target of targets) {
    assert.equal(target.rootEntryModule, "src/index.ts");
  }
});
