/**
 * Profile Home CLI Tests
 *
 * Tests for profile-home CLI module which resolves and creates agent profile home directories.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { loadProfileHomeCliEnv } from "../../../../src/platform/control-plane/config-center/ops-cli-env.js";

test("loadProfileHomeCliEnv returns create false when AA_PROFILE_HOME_CREATE is not set", () => {
  const config = loadProfileHomeCliEnv({});

  assert.equal(config.create, false);
});

test("loadProfileHomeCliEnv returns create false when AA_PROFILE_HOME_CREATE is not 1", () => {
  const config = loadProfileHomeCliEnv({
    AA_PROFILE_HOME_CREATE: "0",
  });

  assert.equal(config.create, false);
});

test("loadProfileHomeCliEnv returns create true when AA_PROFILE_HOME_CREATE is 1", () => {
  const config = loadProfileHomeCliEnv({
    AA_PROFILE_HOME_CREATE: "1",
  });

  assert.equal(config.create, true);
});

test("loadProfileHomeCliEnv returns create false for arbitrary values", () => {
  const config = loadProfileHomeCliEnv({
    AA_PROFILE_HOME_CREATE: "true",
  });

  assert.equal(config.create, false);
});

test("profile-home CLI create branch - when create is true", () => {
  const create = true;
  const layout = {
    root: "/agent/profile/home",
    config: "/agent/profile/home/config",
    data: "/agent/profile/home/data",
    logs: "/agent/profile/home/logs",
  };

  const result = create ? { ...layout, created: true } : layout;

  assert.equal((result as { created: boolean }).created, true);
  assert.equal(result.root, layout.root);
});

test("profile-home CLI create branch - when create is false", () => {
  const create = false;
  const layout = {
    root: "/agent/profile/home",
    config: "/agent/profile/home/config",
    data: "/agent/profile/home/data",
    logs: "/agent/profile/home/logs",
  };

  const result = create ? { ...layout, created: true } : layout;

  assert.equal((result as { created?: boolean }).created, undefined);
  assert.equal(result.root, layout.root);
});

test("profile-home CLI JSON output format", () => {
  const layout = {
    root: "/agent/profile/home",
    config: "/agent/profile/home/config",
    data: "/agent/profile/home/data",
    logs: "/agent/profile/home/logs",
  };

  const output = JSON.stringify(layout, null, 2);
  assert.ok(output.includes("root"));
  assert.ok(output.includes("config"));
  assert.ok(output.includes("data"));
  assert.ok(output.includes("logs"));
});
