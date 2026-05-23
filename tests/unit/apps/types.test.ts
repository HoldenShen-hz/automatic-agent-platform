import assert from "node:assert/strict";
import test from "node:test";

import {
  API_APP_MANIFEST,
  CONSOLE_APP_MANIFEST,
  WORKER_APP_MANIFEST,
  listPlatformApps,
} from "../../../src/apps/index.js";
import type {
  PlatformAppKind,
  PlatformAppManifest,
  PlatformStartupTarget,
  PlatformStartupTargetKind,
} from "../../../src/platform-architecture-types.js";

test("PlatformAppKind type accepts api, console, worker", () => {
  const kinds: PlatformAppKind[] = ["api", "console", "worker"];
  assert.equal(kinds.length, 3);
});

test("PlatformStartupTargetKind type accepts summary, demo, and app kinds", () => {
  const targetKinds: PlatformStartupTargetKind[] = ["summary", "demo", "api", "console", "worker"];
  assert.equal(targetKinds.length, 5);
});

test("all app manifests satisfy PlatformAppManifest type", () => {
  const apps: PlatformAppManifest[] = [API_APP_MANIFEST, CONSOLE_APP_MANIFEST, WORKER_APP_MANIFEST];
  assert.equal(apps.length, 3);
});

test("API_APP_MANIFEST satisfies PlatformAppManifest", () => {
  const manifest: PlatformAppManifest = API_APP_MANIFEST;
  assert.equal(manifest.kind, "api");
});

test("CONSOLE_APP_MANIFEST satisfies PlatformAppManifest", () => {
  const manifest: PlatformAppManifest = CONSOLE_APP_MANIFEST;
  assert.equal(manifest.kind, "console");
});

test("WORKER_APP_MANIFEST satisfies PlatformAppManifest", () => {
  const manifest: PlatformAppManifest = WORKER_APP_MANIFEST;
  assert.equal(manifest.kind, "worker");
});

test("API_APP_MANIFEST satisfies PlatformStartupTarget appManifest", () => {
  const manifest: PlatformAppManifest = API_APP_MANIFEST;
  const target: PlatformStartupTarget = {
    targetKind: "api",
    rootEntryModule: "src/index.ts",
    description: "API app",
    requiredLayers: manifest.requiredLayers,
    startupCommand: manifest.startupCommand,
    appManifest: manifest,
  };
  assert.equal(target.appManifest?.kind, "api");
});

test("PlatformStartupTarget description is string", () => {
  const target: PlatformStartupTarget = {
    targetKind: "summary",
    rootEntryModule: "src/index.ts",
    description: "Summary target",
    requiredLayers: [],
    startupCommand: "npm run start",
    appManifest: null,
  };
  assert.equal(typeof target.description, "string");
});

test("PlatformStartupTarget requiredLayers can be empty", () => {
  const target: PlatformStartupTarget = {
    targetKind: "summary",
    rootEntryModule: "src/index.ts",
    description: "Summary target",
    requiredLayers: [],
    startupCommand: "npm run start",
    appManifest: null,
  };
  assert.ok(Array.isArray(target.requiredLayers));
  assert.equal(target.requiredLayers.length, 0);
});

test("PlatformStartupTarget appManifest can be null", () => {
  const target: PlatformStartupTarget = {
    targetKind: "summary",
    rootEntryModule: "src/index.ts",
    description: "Summary target",
    requiredLayers: [],
    startupCommand: "npm run start",
    appManifest: null,
  };
  assert.equal(target.appManifest, null);
});

test("PlatformStartupTarget startupCommand can be null", () => {
  const target: PlatformStartupTarget = {
    targetKind: "summary",
    rootEntryModule: "src/index.ts",
    description: "Summary target",
    requiredLayers: [],
    startupCommand: null,
    appManifest: null,
  };
  assert.equal(target.startupCommand, null);
});

test("each app manifest has valid startupMode", () => {
  const apps = listPlatformApps();
  for (const app of apps) {
    assert.ok(
      app.startupMode === "daemon" || app.startupMode === "job",
      `Invalid startupMode: ${app.startupMode}`
    );
  }
});

test("daemon apps have non-null port and health endpoint", () => {
  const apps = listPlatformApps();
  const daemonApps = apps.filter((a) => a.startupMode === "daemon");

  for (const app of daemonApps) {
    assert.ok(app.defaultPort != null);
    assert.ok(typeof app.defaultPort === "number");
    assert.ok(app.healthEndpoint != null);
    assert.ok(typeof app.healthEndpoint === "string");
  }
});

test("job apps have null port and health endpoint", () => {
  const apps = listPlatformApps();
  const jobApps = apps.filter((a) => a.startupMode === "job");

  for (const app of jobApps) {
    assert.equal(app.defaultPort, null);
    assert.equal(app.healthEndpoint, null);
  }
});
