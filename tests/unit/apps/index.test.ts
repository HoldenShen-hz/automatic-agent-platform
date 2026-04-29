/**
 * Unit tests for src/apps/ modules
 *
 * Tests manifest structure, app listing, startup target building,
 * and resolution functions.
 *
 * @see src/apps/index.ts
 * @see src/apps/api/index.ts
 * @see src/apps/console/index.ts
 * @see src/apps/workers/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  API_APP_MANIFEST,
} from "../../../src/apps/api/index.js";
import {
  CONSOLE_APP_MANIFEST,
} from "../../../src/apps/console/index.js";
import {
  WORKER_APP_MANIFEST,
} from "../../../src/apps/workers/index.js";
import {
  listPlatformApps,
  listPlatformAppKinds,
  getPlatformAppManifestByKind,
  resolvePlatformAppManifest,
  buildPlatformStartupTargets,
  resolvePlatformStartupTarget,
} from "../../../src/apps/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Individual Manifest Structure Tests
// ─────────────────────────────────────────────────────────────────────────────

test("API_APP_MANIFEST has correct structure", () => {
  assert.equal(API_APP_MANIFEST.appId, "automatic-agent-api");
  assert.equal(API_APP_MANIFEST.kind, "api");
  assert.equal(API_APP_MANIFEST.defaultPort, 8004);
  assert.equal(API_APP_MANIFEST.healthEndpoint, "/health");
  assert.ok(Array.isArray(API_APP_MANIFEST.capabilities));
  assert.ok(API_APP_MANIFEST.capabilities.includes("http_api"));
  assert.ok(Array.isArray(API_APP_MANIFEST.requiredLayers));
  assert.ok(API_APP_MANIFEST.requiredLayers.includes("platform"));
  assert.equal(API_APP_MANIFEST.startupMode, "daemon");
  assert.ok(API_APP_MANIFEST.startupCommand.includes("api"));
});

test("CONSOLE_APP_MANIFEST has correct structure", () => {
  assert.equal(CONSOLE_APP_MANIFEST.appId, "automatic-agent-console");
  assert.equal(CONSOLE_APP_MANIFEST.kind, "console");
  assert.equal(CONSOLE_APP_MANIFEST.defaultPort, 3000);
  assert.equal(CONSOLE_APP_MANIFEST.healthEndpoint, "/api/health");
  assert.ok(Array.isArray(CONSOLE_APP_MANIFEST.capabilities));
  assert.ok(CONSOLE_APP_MANIFEST.capabilities.includes("operator_console"));
  assert.ok(Array.isArray(CONSOLE_APP_MANIFEST.requiredLayers));
  assert.ok(CONSOLE_APP_MANIFEST.requiredLayers.includes("apps"));
  assert.equal(CONSOLE_APP_MANIFEST.startupMode, "daemon");
  assert.ok(CONSOLE_APP_MANIFEST.startupCommand.length > 0);
});

test("WORKER_APP_MANIFEST has correct structure", () => {
  assert.equal(WORKER_APP_MANIFEST.appId, "automatic-agent-worker");
  assert.equal(WORKER_APP_MANIFEST.kind, "worker");
  assert.equal(WORKER_APP_MANIFEST.defaultPort, null);
  assert.equal(WORKER_APP_MANIFEST.healthEndpoint, null);
  assert.ok(Array.isArray(WORKER_APP_MANIFEST.capabilities));
  assert.ok(WORKER_APP_MANIFEST.capabilities.includes("dispatch_execution"));
  assert.ok(Array.isArray(WORKER_APP_MANIFEST.requiredLayers));
  assert.ok(WORKER_APP_MANIFEST.requiredLayers.includes("apps"));
  assert.equal(WORKER_APP_MANIFEST.startupMode, "job");
  assert.ok(WORKER_APP_MANIFEST.startupCommand.includes("worker"));
});

test("All manifests have unique appIds", () => {
  const appIds = [
    API_APP_MANIFEST.appId,
    CONSOLE_APP_MANIFEST.appId,
    WORKER_APP_MANIFEST.appId,
  ];
  const uniqueAppIds = new Set(appIds);
  assert.equal(uniqueAppIds.size, appIds.length);
});

test("All manifests have distinct kinds", () => {
  const kinds = [
    API_APP_MANIFEST.kind,
    CONSOLE_APP_MANIFEST.kind,
    WORKER_APP_MANIFEST.kind,
  ];
  const uniqueKinds = new Set(kinds);
  assert.equal(uniqueKinds.size, kinds.length);
});

test("All manifests have non-empty capabilities arrays", () => {
  assert.ok(API_APP_MANIFEST.capabilities.length > 0);
  assert.ok(CONSOLE_APP_MANIFEST.capabilities.length > 0);
  assert.ok(WORKER_APP_MANIFEST.capabilities.length > 0);
});

test("Worker manifest has null port and health endpoint", () => {
  assert.equal(WORKER_APP_MANIFEST.defaultPort, null);
  assert.equal(WORKER_APP_MANIFEST.healthEndpoint, null);
});

test("API and Console have numeric ports", () => {
  assert.equal(typeof API_APP_MANIFEST.defaultPort, "number");
  assert.equal(typeof CONSOLE_APP_MANIFEST.defaultPort, "number");
  assert.ok(API_APP_MANIFEST.defaultPort > 0);
  assert.ok(CONSOLE_APP_MANIFEST.defaultPort > 0);
});

test("All manifests have non-empty requiredLayers", () => {
  assert.ok(API_APP_MANIFEST.requiredLayers.length > 0);
  assert.ok(CONSOLE_APP_MANIFEST.requiredLayers.length > 0);
  assert.ok(WORKER_APP_MANIFEST.requiredLayers.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// listPlatformApps Tests
// ─────────────────────────────────────────────────────────────────────────────

test("listPlatformApps returns array of 3 manifests", () => {
  const apps = listPlatformApps();
  assert.ok(Array.isArray(apps));
  assert.equal(apps.length, 3);
});

test("listPlatformApps returns frozen array", () => {
  const apps = listPlatformApps();
  assert.ok(Object.isFrozen(apps));
});

test("listPlatformApps contains API manifest", () => {
  const apps = listPlatformApps();
  const apiApp = apps.find((a) => a.kind === "api");
  assert.ok(apiApp !== undefined);
  assert.equal(apiApp?.appId, "automatic-agent-api");
});

test("listPlatformApps contains Console manifest", () => {
  const apps = listPlatformApps();
  const consoleApp = apps.find((a) => a.kind === "console");
  assert.ok(consoleApp !== undefined);
  assert.equal(consoleApp?.appId, "automatic-agent-console");
});

test("listPlatformApps contains Worker manifest", () => {
  const apps = listPlatformApps();
  const workerApp = apps.find((a) => a.kind === "worker");
  assert.ok(workerApp !== undefined);
  assert.equal(workerApp?.appId, "automatic-agent-worker");
});

test("listPlatformApps returns readonly array", () => {
  const apps = listPlatformApps();
  assert.equal(apps.length, 3);
  assert.ok(apps.includes(API_APP_MANIFEST));
  assert.ok(apps.includes(CONSOLE_APP_MANIFEST));
  assert.ok(apps.includes(WORKER_APP_MANIFEST));
});

// ─────────────────────────────────────────────────────────────────────────────
// listPlatformAppKinds Tests
// ─────────────────────────────────────────────────────────────────────────────

test("listPlatformAppKinds returns array of 3 kinds", () => {
  const kinds = listPlatformAppKinds();
  assert.ok(Array.isArray(kinds));
  assert.equal(kinds.length, 3);
});

test("listPlatformAppKinds returns api, console, worker", () => {
  const kinds = listPlatformAppKinds();
  assert.ok(kinds.includes("api"));
  assert.ok(kinds.includes("console"));
  assert.ok(kinds.includes("worker"));
});

test("listPlatformAppKinds returns distinct values", () => {
  const kinds = listPlatformAppKinds();
  const uniqueKinds = new Set(kinds);
  assert.equal(uniqueKinds.size, kinds.length);
});

// ─────────────────────────────────────────────────────────────────────────────
// getPlatformAppManifestByKind Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getPlatformAppManifestByKind returns API manifest for 'api'", () => {
  const manifest = getPlatformAppManifestByKind("api");
  assert.equal(manifest.appId, "automatic-agent-api");
  assert.equal(manifest.kind, "api");
});

test("getPlatformAppManifestByKind returns Console manifest for 'console'", () => {
  const manifest = getPlatformAppManifestByKind("console");
  assert.equal(manifest.appId, "automatic-agent-console");
  assert.equal(manifest.kind, "console");
});

test("getPlatformAppManifestByKind returns Worker manifest for 'worker'", () => {
  const manifest = getPlatformAppManifestByKind("worker");
  assert.equal(manifest.appId, "automatic-agent-worker");
  assert.equal(manifest.kind, "worker");
});

test("getPlatformAppManifestByKind throws for unknown kind", () => {
  assert.throws(
    () => getPlatformAppManifestByKind("unknown"),
    /Unknown platform app kind/,
  );
});

test("getPlatformAppManifestByKind returns correct entryModule for each kind", () => {
  const apiManifest = getPlatformAppManifestByKind("api");
  const consoleManifest = getPlatformAppManifestByKind("console");
  const workerManifest = getPlatformAppManifestByKind("worker");

  assert.ok(apiManifest.entryModule.includes("http-api-server"));
  assert.ok(consoleManifest.entryModule.includes("console-backend"));
  assert.ok(workerManifest.entryModule.includes("execution-worker-writeback"));
});

test("getPlatformAppManifestByKind returns correct startupMode", () => {
  assert.equal(getPlatformAppManifestByKind("api").startupMode, "daemon");
  assert.equal(getPlatformAppManifestByKind("console").startupMode, "daemon");
  assert.equal(getPlatformAppManifestByKind("worker").startupMode, "job");
});

// ─────────────────────────────────────────────────────────────────────────────
// resolvePlatformAppManifest Tests
// ─────────────────────────────────────────────────────────────────────────────

test("resolvePlatformAppManifest returns API manifest for 'api'", () => {
  const manifest = resolvePlatformAppManifest("api");
  assert.ok(manifest !== null);
  assert.equal(manifest?.appId, "automatic-agent-api");
});

test("resolvePlatformAppManifest returns Console manifest for 'console'", () => {
  const manifest = resolvePlatformAppManifest("console");
  assert.ok(manifest !== null);
  assert.equal(manifest?.appId, "automatic-agent-console");
});

test("resolvePlatformAppManifest returns Worker manifest for 'worker'", () => {
  const manifest = resolvePlatformAppManifest("worker");
  assert.ok(manifest !== null);
  assert.equal(manifest?.appId, "automatic-agent-worker");
});

test("resolvePlatformAppManifest returns manifest by appId", () => {
  const manifest = resolvePlatformAppManifest("automatic-agent-api");
  assert.ok(manifest !== null);
  assert.equal(manifest?.kind, "api");
});

test("resolvePlatformAppManifest returns null for unknown selector", () => {
  const manifest = resolvePlatformAppManifest("nonexistent");
  assert.equal(manifest, null);
});

test("resolvePlatformAppManifest returns null for empty string", () => {
  const manifest = resolvePlatformAppManifest("");
  assert.equal(manifest, null);
});

test("resolvePlatformAppManifest matches both kind and appId", () => {
  const byKind = resolvePlatformAppManifest("api");
  const byAppId = resolvePlatformAppManifest("automatic-agent-api");
  assert.ok(byKind !== null);
  assert.ok(byAppId !== null);
  assert.equal(byKind?.appId, byAppId?.appId);
});

// ─────────────────────────────────────────────────────────────────────────────
// buildPlatformStartupTargets Tests
// ─────────────────────────────────────────────────────────────────────────────

test("buildPlatformStartupTargets returns array with at least 5 targets", () => {
  const targets = buildPlatformStartupTargets();
  assert.ok(Array.isArray(targets));
  assert.ok(targets.length >= 5);
});

test("buildPlatformStartupTargets includes summary target", () => {
  const targets = buildPlatformStartupTargets();
  const summaryTarget = targets.find((t) => t.targetKind === "summary");
  assert.ok(summaryTarget !== undefined);
  assert.equal(summaryTarget?.appManifest, null);
  assert.ok(summaryTarget?.description.includes("skeleton"));
});

test("buildPlatformStartupTargets includes demo target", () => {
  const targets = buildPlatformStartupTargets();
  const demoTarget = targets.find((t) => t.targetKind === "demo");
  assert.ok(demoTarget !== undefined);
  assert.equal(demoTarget?.appManifest, null);
  assert.ok(demoTarget?.description.includes("demo"));
});

test("buildPlatformStartupTargets includes API target with manifest", () => {
  const targets = buildPlatformStartupTargets();
  const apiTarget = targets.find((t) => t.targetKind === "api");
  assert.ok(apiTarget !== undefined);
  assert.ok(apiTarget?.appManifest !== null);
  assert.equal(apiTarget?.appManifest?.kind, "api");
});

test("buildPlatformStartupTargets includes Console target with manifest", () => {
  const targets = buildPlatformStartupTargets();
  const consoleTarget = targets.find((t) => t.targetKind === "console");
  assert.ok(consoleTarget !== undefined);
  assert.ok(consoleTarget?.appManifest !== null);
  assert.equal(consoleTarget?.appManifest?.kind, "console");
});

test("buildPlatformStartupTargets includes Worker target with manifest", () => {
  const targets = buildPlatformStartupTargets();
  const workerTarget = targets.find((t) => t.targetKind === "worker");
  assert.ok(workerTarget !== undefined);
  assert.ok(workerTarget?.appManifest !== null);
  assert.equal(workerTarget?.appManifest?.kind, "worker");
});

test("buildPlatformStartupTargets returns readonly array", () => {
  const targets = buildPlatformStartupTargets();
  assert.ok(Array.isArray(targets));
  assert.equal(targets.length >= 5, true);
});

test("buildPlatformStartupTargets summary target has startupCommand", () => {
  const targets = buildPlatformStartupTargets();
  const summaryTarget = targets.find((t) => t.targetKind === "summary");
  assert.ok(summaryTarget?.startupCommand !== null);
  assert.ok(summaryTarget?.startupCommand.length > 0);
});

test("buildPlatformStartupTargets demo target has startupCommand", () => {
  const targets = buildPlatformStartupTargets();
  const demoTarget = targets.find((t) => t.targetKind === "demo");
  assert.ok(demoTarget?.startupCommand !== null);
  assert.ok(demoTarget?.startupCommand.length > 0);
});

test("buildPlatformStartupTargets app targets have startupCommand", () => {
  const targets = buildPlatformStartupTargets();
  const appTargets = targets.filter((t) => t.appManifest !== null);
  assert.ok(appTargets.length === 3);
  for (const target of appTargets) {
    assert.ok(target.startupCommand !== null);
  }
});

test("buildPlatformStartupTargets has correct requiredLayers for each target", () => {
  const targets = buildPlatformStartupTargets();

  const demoTarget = targets.find((t) => t.targetKind === "demo");
  assert.ok(demoTarget?.requiredLayers.includes("platform"));
  assert.ok(demoTarget?.requiredLayers.includes("apps"));

  const apiTarget = targets.find((t) => t.targetKind === "api");
  assert.ok(apiTarget?.requiredLayers.length > 0);
  assert.ok(apiTarget?.appManifest?.requiredLayers.includes("platform"));
});

// ─────────────────────────────────────────────────────────────────────────────
// resolvePlatformStartupTarget Tests
// ─────────────────────────────────────────────────────────────────────────────

test("resolvePlatformStartupTarget returns summary target", () => {
  const target = resolvePlatformStartupTarget("summary");
  assert.equal(target.targetKind, "summary");
  assert.equal(target.appManifest, null);
});

test("resolvePlatformStartupTarget returns demo target", () => {
  const target = resolvePlatformStartupTarget("demo");
  assert.equal(target.targetKind, "demo");
  assert.equal(target.appManifest, null);
});

test("resolvePlatformStartupTarget returns API target", () => {
  const target = resolvePlatformStartupTarget("api");
  assert.equal(target.targetKind, "api");
  assert.ok(target.appManifest !== null);
  assert.equal(target.appManifest?.kind, "api");
});

test("resolvePlatformStartupTarget returns Console target", () => {
  const target = resolvePlatformStartupTarget("console");
  assert.equal(target.targetKind, "console");
  assert.ok(target.appManifest !== null);
  assert.equal(target.appManifest?.kind, "console");
});

test("resolvePlatformStartupTarget returns Worker target", () => {
  const target = resolvePlatformStartupTarget("worker");
  assert.equal(target.targetKind, "worker");
  assert.ok(target.appManifest !== null);
  assert.equal(target.appManifest?.kind, "worker");
});

test("resolvePlatformStartupTarget throws for unknown targetKind", () => {
  assert.throws(
    () => resolvePlatformStartupTarget("unknown" as any),
    /Unknown platform startup target/,
  );
});

test("resolvePlatformStartupTarget returns targets with valid rootEntryModule", () => {
  const targetKinds: Array<"summary" | "demo" | "api" | "console" | "worker"> = [
    "summary", "demo", "api", "console", "worker",
  ];
  for (const kind of targetKinds) {
    const target = resolvePlatformStartupTarget(kind);
    assert.ok(target.rootEntryModule.length > 0);
    assert.ok(
      target.rootEntryModule.endsWith(".ts") || target.rootEntryModule.endsWith(".js"),
    );
  }
});

test("resolvePlatformStartupTarget demo has requiredLayers with platform and apps", () => {
  const target = resolvePlatformStartupTarget("demo");
  assert.ok(target.requiredLayers.includes("platform"));
  assert.ok(target.requiredLayers.includes("apps"));
});

test("resolvePlatformStartupTarget API has startupCommand", () => {
  const target = resolvePlatformStartupTarget("api");
  assert.ok(target.startupCommand !== null);
  assert.ok(target.startupCommand.includes("api"));
});

test("resolvePlatformStartupTarget Console has startupCommand", () => {
  const target = resolvePlatformStartupTarget("console");
  assert.ok(target.startupCommand !== null);
  assert.ok(target.startupCommand.length > 0);
});

test("resolvePlatformStartupTarget Worker has startupCommand", () => {
  const target = resolvePlatformStartupTarget("worker");
  assert.ok(target.startupCommand !== null);
  assert.ok(target.startupCommand.includes("worker"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-function Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getPlatformAppManifestByKind returns same manifest as resolvePlatformAppManifest", () => {
  const kinds: Array<"api" | "console" | "worker"> = ["api", "console", "worker"];
  for (const kind of kinds) {
    const byKind = getPlatformAppManifestByKind(kind);
    const byResolve = resolvePlatformAppManifest(kind);
    assert.ok(byResolve !== null);
    assert.equal(byKind.appId, byResolve?.appId);
    assert.equal(byKind.kind, byResolve?.kind);
  }
});

test("listPlatformApps and buildPlatformStartupTargets apps are consistent", () => {
  const apps = listPlatformApps();
  const targets = buildPlatformStartupTargets();
  const appTargets = targets.filter((t) => t.appManifest !== null);

  assert.equal(apps.length, appTargets.length);
  for (const app of apps) {
    const matchingTarget = appTargets.find((t) => t.appManifest?.appId === app.appId);
    assert.ok(matchingTarget !== undefined);
  }
});

test("resolvePlatformStartupTarget and buildPlatformStartupTargets are consistent", () => {
  const targetKinds: Array<"summary" | "demo" | "api" | "console" | "worker"> = [
    "summary", "demo", "api", "console", "worker",
  ];

  for (const kind of targetKinds) {
    const fromResolve = resolvePlatformStartupTarget(kind);
    const targets = buildPlatformStartupTargets();
    const matchingTarget = targets.find((t) => t.targetKind === kind);

    assert.ok(matchingTarget !== undefined);
    assert.equal(fromResolve.targetKind, matchingTarget?.targetKind);
    assert.equal(fromResolve.description, matchingTarget?.description);
  }
});

test("All PlatformAppKind values map to valid startup targets", () => {
  const kinds = listPlatformAppKinds();
  for (const kind of kinds) {
    const target = resolvePlatformStartupTarget(kind);
    assert.equal(target.targetKind, kind);
    assert.ok(target.appManifest !== null);
    assert.equal(target.appManifest?.kind, kind);
  }
});
