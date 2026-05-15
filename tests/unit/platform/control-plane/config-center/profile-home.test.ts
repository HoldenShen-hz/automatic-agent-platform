import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { ensureAgentProfileHome, resolveAgentProfileHome } from "../../../../../src/platform/five-plane-control-plane/config-center/profile-home.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("resolveAgentProfileHome creates managed home layout from profile id", () => {
  const workspace = createTempWorkspace("aa-profile-home-");
  try {
    const layout = resolveAgentProfileHome(
      {
        AA_PROFILE_ID: "dev-team",
      } as NodeJS.ProcessEnv,
      workspace,
    );

    assert.equal(layout.profileId, "dev-team");
    assert.equal(layout.source, "default_managed_home");
    assert.equal(layout.profileHome, join(workspace, ".aa-profile-homes", "dev-team"));
    assert.equal(layout.promptCacheRoot, join(layout.profileHome, "cache", "prompt-partitions"));
  } finally {
    cleanupPath(workspace);
  }
});

test("resolveAgentProfileHome honors explicit AGENT_HOME", () => {
  const workspace = createTempWorkspace("aa-profile-home-");
  try {
    const layout = resolveAgentProfileHome(
      {
        AA_PROFILE_ID: "prod",
        AGENT_HOME: "./custom-home",
      } as NodeJS.ProcessEnv,
      workspace,
    );

    assert.equal(layout.source, "explicit_home");
    assert.equal(layout.profileId, "prod");
    assert.equal(layout.profileHome, join(workspace, "custom-home"));
  } finally {
    cleanupPath(workspace);
  }
});

test("ensureAgentProfileHome materializes profile directories", () => {
  const workspace = createTempWorkspace("aa-profile-home-");
  try {
    const layout = resolveAgentProfileHome(
      {
        AA_PROFILE_ID: "ops",
      } as NodeJS.ProcessEnv,
      workspace,
    );
    const ensured = ensureAgentProfileHome(layout);

    assert.equal(ensured.profileHome, layout.profileHome);
  } finally {
    cleanupPath(workspace);
  }
});

test("resolveAgentProfileHome fails closed on invalid profile id", () => {
  assert.throws(
    () =>
      resolveAgentProfileHome({
        AA_PROFILE_ID: "../escape",
      } as NodeJS.ProcessEnv, "/tmp"),
    /profile_home\.invalid_profile_id/,
  );
});
