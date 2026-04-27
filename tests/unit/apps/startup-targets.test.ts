import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlatformStartupTargets,
  resolvePlatformStartupTarget,
} from "../../../src/apps/index.js";

test("buildPlatformStartupTargets returns 5 targets", () => {
  const targets = buildPlatformStartupTargets();
  assert.equal(targets.length, 5);
});

test("buildPlatformStartupTargets includes summary target", () => {
  const targets = buildPlatformStartupTargets();
  const summaryTarget = targets.find((t) => t.targetKind === "summary");
  assert.ok(summaryTarget != null);
  assert.equal(summaryTarget.targetKind, "summary");
  assert.equal(summaryTarget.rootEntryModule, "src/index.ts");
  assert.equal(summaryTarget.startupCommand, "npm run start");
  assert.equal(summaryTarget.appManifest, null);
  assert.ok(Array.isArray(summaryTarget.requiredLayers));
  assert.equal(summaryTarget.requiredLayers.length, 0);
});

test("buildPlatformStartupTargets includes demo target", () => {
  const targets = buildPlatformStartupTargets();
  const demoTarget = targets.find((t) => t.targetKind === "demo");
  assert.ok(demoTarget != null);
  assert.equal(demoTarget.targetKind, "demo");
  assert.equal(demoTarget.rootEntryModule, "src/index.ts");
  assert.equal(demoTarget.startupCommand, "npm run demo");
  assert.equal(demoTarget.appManifest, null);
  assert.ok(demoTarget.requiredLayers.includes("platform"));
  assert.ok(demoTarget.requiredLayers.includes("apps"));
});

test("buildPlatformStartupTargets includes api target", () => {
  const targets = buildPlatformStartupTargets();
  const apiTarget = targets.find((t) => t.targetKind === "api");
  assert.ok(apiTarget != null);
  assert.equal(apiTarget.targetKind, "api");
  assert.equal(apiTarget.rootEntryModule, "src/index.ts");
  assert.equal(apiTarget.startupCommand, "npm run api");
  assert.ok(apiTarget.appManifest != null);
  assert.equal(apiTarget.appManifest.kind, "api");
  assert.equal(apiTarget.appManifest.appId, "automatic-agent-api");
});

test("buildPlatformStartupTargets includes console target", () => {
  const targets = buildPlatformStartupTargets();
  const consoleTarget = targets.find((t) => t.targetKind === "console");
  assert.ok(consoleTarget != null);
  assert.equal(consoleTarget.targetKind, "console");
  assert.equal(consoleTarget.rootEntryModule, "src/index.ts");
  assert.equal(consoleTarget.startupCommand, "npm run api");
  assert.ok(consoleTarget.appManifest != null);
  assert.equal(consoleTarget.appManifest.kind, "console");
  assert.equal(consoleTarget.appManifest.appId, "automatic-agent-console");
});

test("buildPlatformStartupTargets includes worker target", () => {
  const targets = buildPlatformStartupTargets();
  const workerTarget = targets.find((t) => t.targetKind === "worker");
  assert.ok(workerTarget != null);
  assert.equal(workerTarget.targetKind, "worker");
  assert.equal(workerTarget.rootEntryModule, "src/index.ts");
  assert.equal(workerTarget.startupCommand, "npm run worker-writeback");
  assert.ok(workerTarget.appManifest != null);
  assert.equal(workerTarget.appManifest.kind, "worker");
  assert.equal(workerTarget.appManifest.appId, "automatic-agent-worker");
});

test("resolvePlatformStartupTarget returns summary target", () => {
  const target = resolvePlatformStartupTarget("summary");
  assert.equal(target.targetKind, "summary");
  assert.equal(target.startupCommand, "npm run start");
});

test("resolvePlatformStartupTarget returns demo target", () => {
  const target = resolvePlatformStartupTarget("demo");
  assert.equal(target.targetKind, "demo");
  assert.equal(target.startupCommand, "npm run demo");
});

test("resolvePlatformStartupTarget returns api target", () => {
  const target = resolvePlatformStartupTarget("api");
  assert.equal(target.targetKind, "api");
  assert.ok(target.appManifest != null);
  assert.equal(target.appManifest.kind, "api");
});

test("resolvePlatformStartupTarget returns console target", () => {
  const target = resolvePlatformStartupTarget("console");
  assert.equal(target.targetKind, "console");
  assert.ok(target.appManifest != null);
  assert.equal(target.appManifest.kind, "console");
});

test("resolvePlatformStartupTarget returns worker target", () => {
  const target = resolvePlatformStartupTarget("worker");
  assert.equal(target.targetKind, "worker");
  assert.ok(target.appManifest != null);
  assert.equal(target.appManifest.kind, "worker");
});

test("resolvePlatformStartupTarget throws for unknown targetKind", () => {
  assert.throws(
    () => resolvePlatformStartupTarget("unknown" as any),
    /^Error: Unknown platform startup target: unknown$/
  );
});

test("each startup target has description", () => {
  const targets = buildPlatformStartupTargets();
  for (const target of targets) {
    assert.ok(typeof target.description === "string");
    assert.ok(target.description.length > 0);
  }
});

test("each app target has correct requiredLayers from manifest", () => {
  const targets = buildPlatformStartupTargets();
  const appTargets = targets.filter((t) => t.appManifest != null);

  for (const target of appTargets) {
    assert.ok(target.appManifest != null);
    assert.deepEqual(target.requiredLayers, target.appManifest.requiredLayers);
  }
});

test("app targets have null startupCommand only for summary/demo", () => {
  const targets = buildPlatformStartupTargets();
  const summaryAndDemo = targets.filter(
    (t) => t.targetKind === "summary" || t.targetKind === "demo"
  );
  const apps = targets.filter((t) => t.appManifest != null);

  for (const target of summaryAndDemo) {
    assert.ok(target.startupCommand != null);
  }

  for (const target of apps) {
    assert.ok(target.startupCommand != null);
  }
});
