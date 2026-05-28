import { readFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.cwd();
const packageJson = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
const changelog = readFileSync(join(cwd, "CHANGELOG.md"), "utf8");

function parseVersion(version) {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (match == null) {
    return null;
  }
  return match.slice(1).map((segment) => Number(segment));
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const delta = left[index] - right[index];
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

if (!/^#\s+changelog/im.test(changelog)) {
  throw new Error("CHANGELOG.md missing top-level heading");
}

const version = String(packageJson.version ?? "").trim();
if (version.length === 0) {
  throw new Error("package.json version missing");
}
if (parseVersion(version) == null) {
  throw new Error(`package.json version is not semver: ${version}`);
}

const versionPattern = new RegExp(`^##\\s+\\[?v?${version.replace(/\./g, "\\.")}\\]?`, "m");
if (!versionPattern.test(changelog)) {
  throw new Error(`CHANGELOG.md missing entry for version ${version}`);
}

const releaseHeadings = [...changelog.matchAll(/^##\s+\[?(v?\d+\.\d+\.\d+)\]?/gm)].map((match) => match[1]);
if (releaseHeadings.length === 0) {
  throw new Error("CHANGELOG.md missing version headings");
}

const normalizedPackageVersion = `v${version}`;
if (releaseHeadings[0] !== version && releaseHeadings[0] !== normalizedPackageVersion) {
  throw new Error(
    `Latest changelog entry must match package.json version ${version}; found ${releaseHeadings[0]}`,
  );
}

for (let index = 1; index < releaseHeadings.length; index += 1) {
  const previous = parseVersion(releaseHeadings[index - 1]);
  const current = parseVersion(releaseHeadings[index]);
  if (previous == null || current == null) {
    throw new Error(`Unsupported changelog version heading: ${releaseHeadings[index]}`);
  }
  if (compareVersions(previous, current) <= 0) {
    throw new Error(
      `CHANGELOG.md version headings must be strictly descending; found ${releaseHeadings[index - 1]} before ${releaseHeadings[index]}`,
    );
  }
}

console.log(`CHANGELOG check passed for version ${version}`);
