import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../../../../");
const tauriMacosLibPath = resolve(repoRoot, "ui/apps/tauri-macos/src-tauri/src/lib.rs");
const tauriLinuxLibPath = resolve(repoRoot, "ui/apps/tauri-linux/src-tauri/src/lib.rs");

function readRustSource(path: string): string {
  return readFileSync(path, "utf8");
}

describe("tauri shell command hardening", () => {
  it("macos run_shell enforces an explicit command allowlist", () => {
    const source = readRustSource(tauriMacosLibPath);

    expect(source).toContain('const ALLOWED_COMMANDS: &[&str] = &["status", "health", "version"];');
    expect(source).toContain("if !is_command_allowed(&command) {");
    expect(source).toContain('return Err(format!("Command not allowed: {}", command));');
  });

  it("linux run_shell enforces the same explicit command allowlist", () => {
    const source = readRustSource(tauriLinuxLibPath);

    expect(source).toContain('const ALLOWED_COMMANDS: &[&str] = &["status", "health", "version"];');
    expect(source).toContain("if !is_command_allowed(&command) {");
    expect(source).toContain('return Err(format!("Command not allowed: {}", command));');
  });
});
