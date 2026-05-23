import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlatformAppManifestByKind,
  listPlatformAppKinds,
  listPlatformApps,
  resolvePlatformAppManifest,
} from "../../../src/apps/index.js";
import type { PlatformAppKind } from "../../../src/platform-architecture-types.js";

test("listPlatformApps returns array with exactly 3 apps", () => {
  const apps = listPlatformApps();
  assert.equal(apps.length, 3);
});

test("listPlatformApps returns frozen array", () => {
  const apps = listPlatformApps();
  assert.ok(Object.isFrozen(apps));
});

test("listPlatformApps contains api manifest", () => {
  const apps = listPlatformApps();
  const apiApp = apps.find((a) => a.kind === "api");
  assert.ok(apiApp != null);
  assert.equal(apiApp.appId, "automatic-agent-api");
});

test("listPlatformApps contains console manifest", () => {
  const apps = listPlatformApps();
  const consoleApp = apps.find((a) => a.kind === "console");
  assert.ok(consoleApp != null);
  assert.equal(consoleApp.appId, "automatic-agent-console");
});

test("listPlatformApps contains worker manifest", () => {
  const apps = listPlatformApps();
  const workerApp = apps.find((a) => a.kind === "worker");
  assert.ok(workerApp != null);
  assert.equal(workerApp.appId, "automatic-agent-worker");
});

test("listPlatformAppKinds returns array with 3 kinds", () => {
  const kinds = listPlatformAppKinds();
  assert.equal(kinds.length, 3);
});

test("listPlatformAppKinds returns correct kinds", () => {
  const kinds = listPlatformAppKinds();
  assert.deepEqual(kinds, ["api", "console", "worker"]);
});

test("listPlatformAppKinds returns array with expected values", () => {
  const kinds = listPlatformAppKinds();
  assert.deepEqual(kinds, ["api", "console", "worker"]);
});

test("getPlatformAppManifestByKind returns api manifest by kind", () => {
  const manifest = getPlatformAppManifestByKind("api");
  assert.equal(manifest.kind, "api");
  assert.equal(manifest.appId, "automatic-agent-api");
});

test("getPlatformAppManifestByKind returns console manifest by kind", () => {
  const manifest = getPlatformAppManifestByKind("console");
  assert.equal(manifest.kind, "console");
  assert.equal(manifest.appId, "automatic-agent-console");
});

test("getPlatformAppManifestByKind returns worker manifest by kind", () => {
  const manifest = getPlatformAppManifestByKind("worker");
  assert.equal(manifest.kind, "worker");
  assert.equal(manifest.appId, "automatic-agent-worker");
});

test("getPlatformAppManifestByKind throws for invalid kind", () => {
  assert.throws(
    () => getPlatformAppManifestByKind("invalid" as unknown as PlatformAppKind),
    /^Error: Unknown platform app kind: invalid$/
  );
});

test("resolvePlatformAppManifest returns api manifest by kind", () => {
  const manifest = resolvePlatformAppManifest("api");
  assert.ok(manifest != null);
  assert.equal(manifest.kind, "api");
});

test("resolvePlatformAppManifest returns api manifest by appId", () => {
  const manifest = resolvePlatformAppManifest("automatic-agent-api");
  assert.ok(manifest != null);
  assert.equal(manifest.kind, "api");
});

test("resolvePlatformAppManifest returns console manifest by kind", () => {
  const manifest = resolvePlatformAppManifest("console");
  assert.ok(manifest != null);
  assert.equal(manifest.kind, "console");
});

test("resolvePlatformAppManifest returns console manifest by appId", () => {
  const manifest = resolvePlatformAppManifest("automatic-agent-console");
  assert.ok(manifest != null);
  assert.equal(manifest.kind, "console");
});

test("resolvePlatformAppManifest returns worker manifest by kind", () => {
  const manifest = resolvePlatformAppManifest("worker");
  assert.ok(manifest != null);
  assert.equal(manifest.kind, "worker");
});

test("resolvePlatformAppManifest returns worker manifest by appId", () => {
  const manifest = resolvePlatformAppManifest("automatic-agent-worker");
  assert.ok(manifest != null);
  assert.equal(manifest.kind, "worker");
});

test("resolvePlatformAppManifest returns null for unknown kind", () => {
  const manifest = resolvePlatformAppManifest("unknown-kind");
  assert.equal(manifest, null);
});

test("resolvePlatformAppManifest returns null for unknown appId", () => {
  const manifest = resolvePlatformAppManifest("unknown-app-id");
  assert.equal(manifest, null);
});

test("all apps have unique appIds", () => {
  const apps = listPlatformApps();
  const appIds = apps.map((a) => a.appId);
  const uniqueAppIds = new Set(appIds);
  assert.equal(uniqueAppIds.size, apps.length);
});

test("all apps have unique kinds", () => {
  const kinds = listPlatformAppKinds();
  const uniqueKinds = new Set(kinds);
  assert.equal(uniqueKinds.size, kinds.length);
});

test("each app manifest has valid entryModule", () => {
  const apps = listPlatformApps();
  for (const app of apps) {
    assert.ok(app.entryModule.startsWith("src/"));
    assert.ok(app.entryModule.endsWith(".ts"));
  }
});

test("each app manifest has valid startupCommand", () => {
  const apps = listPlatformApps();
  for (const app of apps) {
    assert.ok(app.startupCommand.startsWith("npm run"));
  }
});
