import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../../../../");
const tauriMacosLibPath = resolve(repoRoot, "ui/apps/tauri-macos/src-tauri/src/lib.rs");
const tauriLinuxLibPath = resolve(repoRoot, "ui/apps/tauri-linux/src-tauri/src/lib.rs");
function readRustSource(path) {
    return readFileSync(path, "utf8");
}
describe("tauri shell command hardening", () => {
    it("macos run_shell enforces an explicit command allowlist", () => {
        const source = readRustSource(tauriMacosLibPath);
        expect(source).toContain('const ALLOWED_COMMANDS: &[&str] = &["status", "health", "version"];');
        expect(source).toContain("if !is_command_allowed(&command) {");
        expect(source).toContain('return Err(format!("Command not allowed: {}", command));');
        expect(source).toContain("const ALLOWED_DEEP_LINK_SCHEMES: &[&str] = &[\"aa://\", \"https://\", \"http://\"];");
        expect(source).toContain("fn keychain_store(key: String, value: String) -> Result<String, String> {");
        expect(source).toContain("fn spotlight_export(query: String) -> Result<String, String> {");
    });
    it("linux run_shell enforces the same explicit command allowlist", () => {
        const source = readRustSource(tauriLinuxLibPath);
        expect(source).toContain('const ALLOWED_COMMANDS: &[&str] = &["status", "health", "version"];');
        expect(source).toContain("if !is_command_allowed(&command) {");
        expect(source).toContain('return Err(format!("Command not allowed: {}", command));');
        expect(source).toContain("fn dbus_notify(summary: String, body: String) -> Result<String, String> {");
        expect(source).toContain("fn detect_display_server() -> &'static str {");
        expect(source).toContain("fn register_system_tray() -> &'static str {");
    });
});
