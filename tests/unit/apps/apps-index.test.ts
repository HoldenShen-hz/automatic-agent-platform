import assert from "node:assert/strict";
import test from "node:test";

import {
  listPlatformApps,
  listPlatformAppKinds,
  getPlatformAppManifestByKind,
  resolvePlatformAppManifest,
  buildPlatformStartupTargets,
  resolvePlatformStartupTarget,
} from "../../../src/apps/index.js";
import type { PlatformAppKind } from "../../../src/platform-architecture-types.js";

test("listPlatformApps returns exactly 3 app manifests", () => {
  const apps = listPlatformApps();
  assert.equal(apps.length, 3, "should have 3 platform apps");
});

test("listPlatformApps returns api, console, worker manifests", () => {
  const apps = listPlatformApps();
  const kinds = apps.map((a) => a.kind);
  assert.deepEqual(kinds, ["api", "console", "worker"]);
});

test("listPlatformApps returns frozen array", () => {
  const apps = listPlatformApps();
  assert.ok(Object.isFrozen(apps), "listPlatformApps should return frozen array");
});

test("listPlatformAppKinds returns all app kinds", () => {
  const kinds = listPlatformAppKinds();
  assert.deepEqual(kinds, ["api", "console", "worker"]);
});

test("getPlatformAppManifestByKind returns correct manifest for api", () => {
  const manifest = getPlatformAppManifestByKind("api");
  assert.equal(manifest.kind, "api");
  assert.ok(manifest.appId.length > 0);
  assert.ok(manifest.entryModule.length > 0);
});

test("getPlatformAppManifestByKind returns correct manifest for console", () => {
  const manifest = getPlatformAppManifestByKind("console");
  assert.equal(manifest.kind, "console");
  assert.ok(manifest.appId.length > 0);
});

test("getPlatformAppManifestByKind returns correct manifest for worker", () => {
  const manifest = getPlatformAppManifestByKind("worker");
  assert.equal(manifest.kind, "worker");
  assert.ok(manifest.appId.length > 0);
});

test("getPlatformAppManifestByKind throws for unknown kind", () => {
  assert.throws(
    () => getPlatformAppManifestByKind("unknown" as PlatformAppKind),
    (err: any) => err.message.includes("Unknown platform app kind"),
  );
});

test("resolvePlatformAppManifest returns manifest by kind", () => {
  const manifest = resolvePlatformAppManifest("api");
  assert.ok(manifest != null);
  assert.equal(manifest!.kind, "api");
});

test("resolvePlatformAppManifest returns manifest by appId", () => {
  const apps = listPlatformApps();
  const firstApp = apps[0]!;
  const manifest = resolvePlatformAppManifest(firstApp.appId);
  assert.ok(manifest != null);
  assert.equal(manifest!.appId, firstApp.appId);
});

test("resolvePlatformAppManifest returns null for unknown selector", () => {
  const manifest = resolvePlatformAppManifest("nonexistent");
  assert.equal(manifest, null);
});

test("buildPlatformStartupTargets returns exactly 5 targets", () => {
  const targets = buildPlatformStartupTargets();
  assert.equal(targets.length, 5, "should have summary, demo, api, console, worker");
});

test("buildPlatformStartupTargets first target is summary with no required layers", () => {
  const targets = buildPlatformStartupTargets();
  const summary = targets.find((t) => t.targetKind === "summary")!;
  assert.equal(summary.targetKind, "summary");
  assert.equal(summary.requiredLayers.length, 0);
  assert.equal(summary.appManifest, null);
});

test("buildPlatformStartupTargets demo target requires platform and apps layers", () => {
  const targets = buildPlatformStartupTargets();
  const demo = targets.find((t) => t.targetKind === "demo")!;
  assert.ok(demo.requiredLayers.includes("platform"));
  assert.ok(demo.requiredLayers.includes("apps"));
});

test("buildPlatformStartupTargets api/console/worker targets have appManifests", () => {
  const targets = buildPlatformStartupTargets();
  const api = targets.find((t) => t.targetKind === "api")!;
  const console = targets.find((t) => t.targetKind === "console")!;
  const worker = targets.find((t) => t.targetKind === "worker")!;

  assert.ok(api.appManifest != null);
  assert.equal(api.appManifest!.kind, "api");
  assert.ok(console.appManifest != null);
  assert.equal(console.appManifest!.kind, "console");
  assert.ok(worker.appManifest != null);
  assert.equal(worker.appManifest!.kind, "worker");
});

test("resolvePlatformStartupTarget resolves summary target", () => {
  const target = resolvePlatformStartupTarget("summary");
  assert.equal(target.targetKind, "summary");
  assert.equal(target.rootEntryModule, "src/index.ts");
});

test("resolvePlatformStartupTarget resolves demo target", () => {
  const target = resolvePlatformStartupTarget("demo");
  assert.equal(target.targetKind, "demo");
  assert.ok(target.requiredLayers.includes("platform"));
});

test("resolvePlatformStartupTarget resolves api target", () => {
  const target = resolvePlatformStartupTarget("api");
  assert.equal(target.targetKind, "api");
  assert.ok(target.appManifest != null);
});

test("resolvePlatformStartupTarget resolves console target", () => {
  const target = resolvePlatformStartupTarget("console");
  assert.equal(target.targetKind, "console");
  assert.ok(target.appManifest != null);
});

test("resolvePlatformStartupTarget resolves worker target", () => {
  const target = resolvePlatformStartupTarget("worker");
  assert.equal(target.targetKind, "worker");
  assert.ok(target.appManifest != null);
});

test("resolvePlatformStartupTarget throws for unknown target", () => {
  assert.throws(
    () => resolvePlatformStartupTarget("unknown" as any),
    (err: any) => err.message.includes("Unknown platform startup target"),
  );
});

test("app manifests have correct startup modes", () => {
  const apps = listPlatformApps();
  for (const app of apps) {
    assert.ok(app.startupMode === "daemon" || app.startupMode === "job");
  }
});

test("app manifests have required layers", () => {
  const apps = listPlatformApps();
  for (const app of apps) {
    assert.ok(Array.isArray(app.requiredLayers));
  }
});
