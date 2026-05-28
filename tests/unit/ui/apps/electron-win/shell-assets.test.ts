import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { resolveRepoPath } from "../../../../helpers/repo-root.js";

const html = fs.readFileSync(
  resolveRepoPath("ui/apps/electron-win/index.html"),
  "utf-8",
);
const packageJson = JSON.parse(
  fs.readFileSync(
    resolveRepoPath("ui/apps/electron-win/package.json"),
    "utf-8",
  ),
) as {
  main?: string;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  build?: {
    win?: Record<string, unknown>;
  };
};

test("electron shell html defines a restrictive CSP meta tag", () => {
  assert.ok(html.includes("Content-Security-Policy"));
  assert.ok(html.includes("default-src 'self'"));
  assert.ok(html.includes("script-src 'self'"));
  assert.ok(html.includes("worker-src 'self'"));
  assert.ok(html.includes("frame-ancestors 'none'"));
});

test("electron shell package declares runtime and signing build metadata", () => {
  assert.equal(packageJson.main, "dist/main.js");
  assert.equal(packageJson.scripts?.build, "tsc -p tsconfig.json && node ./scripts/prepare-shell-assets.mjs");
  assert.equal(packageJson.devDependencies?.electron, "^31.0.0");
  assert.equal(packageJson.devDependencies?.["electron-updater"], "^6.6.2");
  assert.equal(packageJson.build?.win?.verifyUpdateCodeSignature, true);
  assert.equal(packageJson.build?.win?.signAndEditExecutable, false);
});
