import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { resolveRepoPath } from "../../../../helpers/repo-root.js";

import {
  createTauriMacosAdapter,
  createTauriMacosDefaultAdapter,
  tauriMacosManifest,
} from "../../../../../ui/apps/tauri-macos/src/index.js";

const rustSource = fs.readFileSync(
  resolveRepoPath("ui/apps/tauri-macos/src-tauri/src/lib.rs"),
  "utf-8",
);
const cargoToml = fs.readFileSync(
  resolveRepoPath("ui/apps/tauri-macos/src-tauri/Cargo.toml"),
  "utf-8",
);

test("tauri macOS manifest keeps updater channel enabled", () => {
  assert.equal(tauriMacosManifest.platform, "macos");
  assert.equal(tauriMacosManifest.runtime, "tauri");
  assert.equal(tauriMacosManifest.updateChannel, "stable");
});

test("tauri macOS adapter helpers preserve platform wiring", () => {
  assert.equal(createTauriMacosAdapter({ platform: "linux" } as any).platform, "macos");
  assert.equal(createTauriMacosDefaultAdapter().platform, "macos");
});

test("open_deep_link rejects non-http(s) schemes", () => {
  assert.ok(rustSource.includes("ALLOWED_DEEP_LINK_SCHEMES"));
  assert.ok(rustSource.includes("\"aa://\""));
  assert.ok(rustSource.includes("\"https://\""));
  assert.ok(rustSource.includes("\"http://\""));
  assert.ok(rustSource.includes("allowed.eq_ignore_ascii_case(&scheme)"));
  assert.ok(rustSource.includes("rejected:invalid_scheme"));
});

test("Cargo.toml declares updater and secure-storage once with valid TOML comments", () => {
  assert.equal((cargoToml.match(/tauri-plugin-updater = \"2\"/g) ?? []).length, 1);
  assert.equal((cargoToml.match(/tauri-plugin-secure-storage = \"2\"/g) ?? []).length, 1);
  assert.equal(cargoToml.includes("//"), false);
});
