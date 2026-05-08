import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlatformStartupTargets,
  listPlatformAppKinds,
  listPlatformApps,
  resolvePlatformAppManifest,
  resolvePlatformStartupTarget,
} from "../../../src/apps/index.js";

test("listPlatformApps returns the canonical app manifests", () => {
  const apps = listPlatformApps();
  assert.equal(apps.length, 3);
  assert.deepEqual(apps.map((app) => app.kind), ["api", "console", "worker"]);
});

test("platform app helpers resolve manifests and startup targets", () => {
  assert.deepEqual(listPlatformAppKinds(), ["api", "console", "worker"]);
  assert.equal(resolvePlatformAppManifest("automatic-agent-api")?.kind, "api");
  assert.equal(resolvePlatformStartupTarget("worker").appManifest?.startupCommand, "npm run worker-writeback");
  assert.equal(buildPlatformStartupTargets().length, 5);
});
