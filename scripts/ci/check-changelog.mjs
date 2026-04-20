import { readFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const packageJson = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
const changelog = readFileSync(join(cwd, "CHANGELOG.md"), "utf8");

if (!/^#\s+changelog/im.test(changelog)) {
  throw new Error("CHANGELOG.md missing top-level heading");
}

const version = String(packageJson.version ?? "").trim();
if (version.length === 0) {
  throw new Error("package.json version missing");
}

const versionPattern = new RegExp(`^##\\s+\\[?v?${version.replace(/\./g, "\\.")}\\]?`, "m");
if (!versionPattern.test(changelog)) {
  throw new Error(`CHANGELOG.md missing entry for version ${version}`);
}

console.log(`CHANGELOG check passed for version ${version}`);
