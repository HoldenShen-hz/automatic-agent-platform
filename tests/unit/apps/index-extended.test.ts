import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlatformAppManifestByKind,
  listPlatformApps,
  resolvePlatformAppManifest,
} from "../../../src/apps/index.js";

test("getPlatformAppManifestByKind returns correct manifest for each kind", () => {
  const apiManifest = getPlatformAppManifestByKind("api");
  assert.equal(apiManifest.appId, "automatic-agent-api");
  assert.equal(apiManifest.kind, "api");

  const consoleManifest = getPlatformAppManifestByKind("console");
  assert.equal(consoleManifest.appId, "automatic-agent-console");
  assert.equal(consoleManifest.kind, "console");

  const workerManifest = getPlatformAppManifestByKind("worker");
  assert.equal(workerManifest.appId, "automatic-agent-worker");
  assert.equal(workerManifest.kind, "worker");
});

test("getPlatformAppManifestByKind throws for unknown kind", () => {
  assert.throws(
    () => getPlatformAppManifestByKind("unknown" as any),
    /^Error: Unknown platform app kind: unknown$/
  );
});

test("listPlatformApps returns frozen array", () => {
  const apps = listPlatformApps();
  assert.ok(Object.isFrozen(apps));
});

test("resolvePlatformAppManifest accepts kind string", () => {
  const manifest = resolvePlatformAppManifest("api");
  assert.ok(manifest != null);
  assert.equal(manifest!.kind, "api");
});

test("resolvePlatformAppManifest accepts appId string", () => {
  const manifest = resolvePlatformAppManifest("automatic-agent-api");
  assert.ok(manifest != null);
  assert.equal(manifest!.kind, "api");
});

test("resolvePlatformAppManifest returns null for unknown selector", () => {
  const manifest = resolvePlatformAppManifest("nonexistent");
  assert.equal(manifest, null);
});

test("listPlatformApps returns all 3 apps", () => {
  const apps = listPlatformApps();
  assert.equal(apps.length, 3);
  const kinds = apps.map((a) => a.kind);
  assert.ok(kinds.includes("api"));
  assert.ok(kinds.includes("console"));
  assert.ok(kinds.includes("worker"));
});
