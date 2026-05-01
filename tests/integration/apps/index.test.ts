/**
 * Integration tests for src/apps/ modules
 *
 * Tests cross-module interactions, type compatibility with platform types,
 * and integration with the broader platform architecture.
 *
 * @see src/apps/index.ts
 * @see src/platform-architecture-types.ts
 */

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
import type {
  PlatformAppKind,
  PlatformAppManifest,
  PlatformStartupTarget,
  PlatformStartupTargetKind,
  PlatformArchitectureLayer,
} from "../../../src/platform-architecture-types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Type Compatibility Tests
// ─────────────────────────────────────────────────────────────────────────────

test("API manifest conforms to PlatformAppManifest interface", () => {
  const apps = listPlatformApps();
  for (const app of apps) {
    // Verify all required fields are present and correctly typed
    assert.ok(typeof app.appId === "string");
    assert.ok(typeof app.kind === "string");
    assert.ok(typeof app.entryModule === "string");
    assert.ok(app.defaultPort === null || typeof app.defaultPort === "number");
    assert.ok(app.healthEndpoint === null || typeof app.healthEndpoint === "string");
    assert.ok(Array.isArray(app.capabilities));
    assert.ok(Array.isArray(app.requiredLayers));
    assert.ok(typeof app.startupCommand === "string");
    assert.ok(app.startupMode === "daemon" || app.startupMode === "job");

    // Verify requiredLayers are valid PlatformArchitectureLayer values
    for (const layer of app.requiredLayers) {
      const validLayers: PlatformArchitectureLayer[] = [
        "platform", "domains", "interaction", "org-governance",
        "scale-ecosystem", "ops-maturity", "plugins", "sdk", "apps",
      ];
      assert.ok(validLayers.includes(layer), `Invalid layer: ${layer}`);
    }

    // Verify capabilities are non-empty strings
    for (const cap of app.capabilities) {
      assert.ok(typeof cap === "string");
      assert.ok(cap.length > 0);
    }
  }
});

test("Manifest kinds are valid PlatformAppKind values", () => {
  const apps = listPlatformApps();
  const validKinds: PlatformAppKind[] = ["api", "console", "worker"];

  for (const app of apps) {
    assert.ok(validKinds.includes(app.kind), `Invalid kind: ${app.kind}`);
  }
});

test("All app kinds are represented in listPlatformAppKinds", () => {
  const kinds = listPlatformAppKinds();
  const validKinds: PlatformAppKind[] = ["api", "console", "worker"];

  for (const kind of validKinds) {
    assert.ok(kinds.includes(kind), `Missing kind: ${kind}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Startup Target Structure Tests
// ─────────────────────────────────────────────────────────────────────────────

test("All startup targets conform to PlatformStartupTarget interface", () => {
  const targets = buildPlatformStartupTargets();

  for (const target of targets) {
    assert.ok(typeof target.targetKind === "string");
    assert.ok(typeof target.rootEntryModule === "string");
    assert.ok(typeof target.description === "string");
    assert.ok(Array.isArray(target.requiredLayers));
    assert.ok(target.startupCommand === null || typeof target.startupCommand === "string");
    assert.ok(target.appManifest === null || typeof target.appManifest === "object");

    // Verify requiredLayers are valid
    for (const layer of target.requiredLayers) {
      const validLayers: PlatformArchitectureLayer[] = [
        "platform", "domains", "interaction", "org-governance",
        "scale-ecosystem", "ops-maturity", "plugins", "sdk", "apps",
      ];
      assert.ok(validLayers.includes(layer), `Invalid layer: ${layer}`);
    }

    // Verify appManifest conforms to PlatformAppManifest if present
    if (target.appManifest) {
      assert.ok(typeof target.appManifest.appId === "string");
      assert.ok(typeof target.appManifest.kind === "string");
      assert.ok(typeof target.appManifest.entryModule === "string");
    }
  }
});

test("Startup target kinds are valid PlatformStartupTargetKind values", () => {
  const targets = buildPlatformStartupTargets();
  const validTargetKinds: PlatformStartupTargetKind[] = ["summary", "demo", "api", "console", "worker"];

  for (const target of targets) {
    assert.ok(
      validTargetKinds.includes(target.targetKind),
      `Invalid targetKind: ${target.targetKind}`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-Module Consistency Tests
// ─────────────────────────────────────────────────────────────────────────────

test("listPlatformApps and getPlatformAppManifestByKind are consistent", () => {
  const apps = listPlatformApps();
  const kinds: PlatformAppKind[] = ["api", "console", "worker"];

  for (const kind of kinds) {
    const manifest = getPlatformAppManifestByKind(kind);
    const fromList = apps.find((a) => a.kind === kind);

    assert.ok(fromList !== undefined, `No app found for kind: ${kind}`);
    assert.equal(manifest.appId, fromList?.appId);
    assert.equal(manifest.kind, fromList?.kind);
    assert.equal(manifest.defaultPort, fromList?.defaultPort);
    assert.equal(manifest.healthEndpoint, fromList?.healthEndpoint);
  }
});

test("resolvePlatformAppManifest returns same results as getPlatformAppManifestByKind", () => {
  const kinds: PlatformAppKind[] = ["api", "console", "worker"];

  for (const kind of kinds) {
    const byKind = getPlatformAppManifestByKind(kind);
    const byResolve = resolvePlatformAppManifest(kind);

    assert.ok(byResolve !== null, `resolvePlatformAppManifest returned null for: ${kind}`);
    assert.equal(byKind.appId, byResolve?.appId);
  }
});

test("buildPlatformStartupTargets and resolvePlatformStartupTarget are consistent", () => {
  const targetKinds: PlatformStartupTargetKind[] = ["summary", "demo", "api", "console", "worker"];

  for (const kind of targetKinds) {
    const resolved = resolvePlatformStartupTarget(kind);
    const fromBuild = buildPlatformStartupTargets().find((t) => t.targetKind === kind);

    assert.ok(fromBuild !== undefined, `No target found for kind: ${kind}`);
    assert.equal(resolved.targetKind, fromBuild?.targetKind);
    assert.equal(resolved.description, fromBuild?.description);
    assert.equal(resolved.rootEntryModule, fromBuild?.rootEntryModule);
    assert.deepEqual(resolved.requiredLayers, fromBuild?.requiredLayers);
  }
});

test("App manifests in startup targets match listPlatformApps", () => {
  const apps = listPlatformApps();
  const targets = buildPlatformStartupTargets();
  const appTargets = targets.filter((t) => t.appManifest !== null);

  assert.equal(apps.length, appTargets.length, "App count mismatch between listPlatformApps and buildPlatformStartupTargets");

  for (const app of apps) {
    const matchingTarget = appTargets.find((t) => t.appManifest?.appId === app.appId);
    assert.ok(
      matchingTarget !== undefined,
      `App ${app.appId} not found in buildPlatformStartupTargets`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Startup Mode and Port Configuration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Daemon apps have numeric ports and health endpoints", () => {
  const apps = listPlatformApps();
  const daemonApps = apps.filter((a) => a.startupMode === "daemon");

  assert.ok(daemonApps.length > 0, "No daemon apps found");

  for (const app of daemonApps) {
    assert.ok(
      typeof app.defaultPort === "number" && app.defaultPort > 0,
      `Daemon app ${app.appId} missing valid port`,
    );
    assert.ok(
      typeof app.healthEndpoint === "string" && app.healthEndpoint.length > 0,
      `Daemon app ${app.appId} missing health endpoint`,
    );
  }
});

test("Job apps have null ports and null health endpoints", () => {
  const apps = listPlatformApps();
  const jobApps = apps.filter((a) => a.startupMode === "job");

  assert.ok(jobApps.length > 0, "No job apps found");

  for (const app of jobApps) {
    assert.equal(
      app.defaultPort,
      null,
      `Job app ${app.appId} should have null port`,
    );
    assert.equal(
      app.healthEndpoint,
      null,
      `Job app ${app.appId} should have null health endpoint`,
    );
  }
});

test("Each app has unique capabilities set", () => {
  const apps = listPlatformApps();
  const capabilitiesSets = apps.map((a) => new Set(a.capabilities));

  for (let i = 0; i < capabilitiesSets.length; i++) {
    const setA = capabilitiesSets[i];
    if (!setA) continue;
    for (let j = i + 1; j < capabilitiesSets.length; j++) {
      const setB = capabilitiesSets[j];
      if (!setB) continue;
      const intersection = [...setA].filter((cap) => setB.has(cap));
      // Some overlap is allowed (e.g., "platform" layer), but not complete equality
      assert.ok(
        intersection.length < setA.size,
        `Apps ${i} and ${j} have identical capabilities`,
      );
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Required Layers and Architecture Tests
// ─────────────────────────────────────────────────────────────────────────────

test("All apps require the 'apps' layer", () => {
  const apps = listPlatformApps();

  for (const app of apps) {
    assert.ok(
      app.requiredLayers.includes("apps"),
      `App ${app.appId} missing 'apps' in requiredLayers`,
    );
  }
});

test("All apps require the 'platform' layer", () => {
  const apps = listPlatformApps();

  for (const app of apps) {
    assert.ok(
      app.requiredLayers.includes("platform"),
      `App ${app.appId} missing 'platform' in requiredLayers`,
    );
  }
});

test("API app requires the most layers (full stack)", () => {
  const apiManifest = getPlatformAppManifestByKind("api");

  assert.ok(apiManifest.requiredLayers.length >= 7, "API app should require at least 7 layers");
  assert.ok(apiManifest.requiredLayers.includes("org-governance"));
  assert.ok(apiManifest.requiredLayers.includes("scale-ecosystem"));
  assert.ok(apiManifest.requiredLayers.includes("ops-maturity"));
});

test("Console app requires intermediate layer set", () => {
  const consoleManifest = getPlatformAppManifestByKind("console");

  assert.ok(consoleManifest.requiredLayers.includes("org-governance"));
  assert.ok(consoleManifest.requiredLayers.includes("scale-ecosystem"));
  assert.ok(consoleManifest.requiredLayers.includes("ops-maturity"));
});

test("Worker app has minimal layer requirements", () => {
  const workerManifest = getPlatformAppManifestByKind("worker");

  // Worker should not require interaction or org-governance
  assert.ok(!workerManifest.requiredLayers.includes("interaction"));
  assert.ok(!workerManifest.requiredLayers.includes("org-governance"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Startup Target Detail Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Summary target has null appManifest and startupCommand", () => {
  const summaryTarget = resolvePlatformStartupTarget("summary");

  assert.equal(summaryTarget.appManifest, null);
  assert.ok(summaryTarget.startupCommand !== null);
  assert.ok(summaryTarget.startupCommand.length > 0);
  assert.ok(summaryTarget.description.length > 0);
  assert.ok(summaryTarget.requiredLayers.length === 0);
});

test("Demo target has null appManifest and valid startupCommand", () => {
  const demoTarget = resolvePlatformStartupTarget("demo");

  assert.equal(demoTarget.appManifest, null);
  assert.ok(demoTarget.startupCommand !== null);
  assert.ok(demoTarget.startupCommand.includes("demo"));
  assert.ok(demoTarget.requiredLayers.includes("platform"));
  assert.ok(demoTarget.requiredLayers.includes("apps"));
});

test("API target has valid appManifest and startupCommand", () => {
  const apiTarget = resolvePlatformStartupTarget("api");

  assert.ok(apiTarget.appManifest !== null);
  assert.equal(apiTarget.appManifest?.kind, "api");
  assert.ok(apiTarget.startupCommand !== null);
  assert.ok(apiTarget.startupCommand.includes("api"));
  assert.ok(apiTarget.requiredLayers.length > 0);
});

test("Console target has valid appManifest and startupCommand", () => {
  const consoleTarget = resolvePlatformStartupTarget("console");

  assert.ok(consoleTarget.appManifest !== null);
  assert.equal(consoleTarget.appManifest?.kind, "console");
  assert.ok(consoleTarget.startupCommand !== null);
  assert.ok(consoleTarget.startupCommand.length > 0);
  assert.ok(consoleTarget.requiredLayers.length > 0);
});

test("Worker target has valid appManifest and startupCommand", () => {
  const workerTarget = resolvePlatformStartupTarget("worker");

  assert.ok(workerTarget.appManifest !== null);
  assert.equal(workerTarget.appManifest?.kind, "worker");
  assert.ok(workerTarget.startupCommand !== null);
  assert.ok(workerTarget.startupCommand.includes("worker"));
  assert.ok(workerTarget.requiredLayers.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases and Error Handling
// ─────────────────────────────────────────────────────────────────────────────

test("getPlatformAppManifestByKind throws with descriptive message", () => {
  try {
    getPlatformAppManifestByKind("invalid" as any);
    assert.fail("Expected error to be thrown");
  } catch (err: any) {
    assert.ok(err.message.includes("Unknown platform app kind"));
    assert.ok(err.message.includes("invalid"));
  }
});

test("resolvePlatformStartupTarget throws with descriptive message", () => {
  try {
    resolvePlatformStartupTarget("invalid" as any);
    assert.fail("Expected error to be thrown");
  } catch (err: any) {
    assert.ok(err.message.includes("Unknown platform startup target"));
    assert.ok(err.message.includes("invalid"));
  }
});

test("resolvePlatformAppManifest returns null for edge case values", () => {
  assert.equal(resolvePlatformAppManifest("unknown-app"), null);
  assert.equal(resolvePlatformAppManifest("UNKNOWN"), null);
  assert.equal(resolvePlatformAppManifest("API"), null); // case-sensitive
  assert.equal(resolvePlatformAppManifest("Console"), null); // case-sensitive
});

test("listPlatformApps returns frozen array that cannot be modified", () => {
  const apps = listPlatformApps();
  assert.ok(Object.isFrozen(apps), "listPlatformApps should return frozen array");

  // Attempting to modify should throw
  try {
    (apps as any).push({});
    assert.fail("Should have thrown on modification attempt");
  } catch {
    // Expected - cannot modify frozen array
  }
});

test("buildPlatformStartupTargets returns array", () => {
  const targets = buildPlatformStartupTargets();
  assert.ok(Array.isArray(targets));
  assert.equal(targets.length >= 5, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Entry Module Path Validation
// ─────────────────────────────────────────────────────────────────────────────

test("API entryModule points to valid platform interface module", () => {
  const apiManifest = getPlatformAppManifestByKind("api");
  assert.ok(apiManifest.entryModule.includes("platform"));
  assert.ok(apiManifest.entryModule.includes("interface"));
  assert.ok(apiManifest.entryModule.includes("http-api-server"));
});

test("Console entryModule points to valid platform interface module", () => {
  const consoleManifest = getPlatformAppManifestByKind("console");
  assert.ok(consoleManifest.entryModule.includes("platform"));
  assert.ok(consoleManifest.entryModule.includes("console-backend"));
});

test("Worker entryModule points to valid execution module", () => {
  const workerManifest = getPlatformAppManifestByKind("worker");
  assert.ok(workerManifest.entryModule.includes("platform"));
  assert.ok(workerManifest.entryModule.includes("execution"));
  assert.ok(workerManifest.entryModule.includes("worker-pool"));
});

test("All entryModules use .ts extension or src/ path format", () => {
  const apps = listPlatformApps();
  for (const app of apps) {
    assert.ok(
      app.entryModule.endsWith(".ts") || app.entryModule.includes("/"),
      `Invalid entryModule format: ${app.entryModule}`,
    );
  }
});
