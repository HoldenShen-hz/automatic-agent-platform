import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  createTauriLinuxAdapter,
  createTauriLinuxDefaultAdapter,
  tauriLinuxManifest,
} from "../../../../../ui/apps/tauri-linux/src/index.js";

const cargoToml = fs.readFileSync(
  "/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/tauri-linux/src-tauri/Cargo.toml",
  "utf-8",
);
const packageJson = JSON.parse(
  fs.readFileSync(
    "/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/tauri-linux/package.json",
    "utf-8",
  ),
) as {
  name: string;
  scripts?: Record<string, string>;
};

test("tauri linux manifest now carries update channel metadata", () => {
  assert.equal(tauriLinuxManifest.platform, "linux");
  assert.equal(tauriLinuxManifest.runtime, "tauri");
  assert.equal(tauriLinuxManifest.supportsBackgroundAgent, false);
  assert.equal(tauriLinuxManifest.updateChannel, "stable");
});

test("tauri linux adapter helpers preserve linux platform wiring", () => {
  assert.equal(createTauriLinuxAdapter({ platform: "macos" } as any).platform, "linux");
  assert.equal(createTauriLinuxDefaultAdapter().platform, "linux");
});

test("linux Cargo.toml keeps updater plugin exactly once with TOML-safe comments", () => {
  assert.equal((cargoToml.match(/tauri-plugin-updater = \"2\"/g) ?? []).length, 1);
  assert.equal((cargoToml.match(/tauri-plugin-secure-storage = \"2\"/g) ?? []).length, 1);
  assert.equal(cargoToml.includes("//"), false);
});

test("tauri linux package metadata remains valid", () => {
  assert.equal(packageJson.name, "@aa/tauri-linux");
  assert.ok(packageJson.scripts?.smoke);
});
