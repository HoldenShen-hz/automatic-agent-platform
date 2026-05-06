import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  "/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/electron-win/index.html",
  "utf-8",
);
const packageJson = JSON.parse(
  fs.readFileSync(
    "/Users/holden/Project/automatic_agent/automatic_agent_platform/ui/apps/electron-win/package.json",
    "utf-8",
  ),
) as {
  devDependencies?: Record<string, string>;
  build?: {
    win?: Record<string, unknown>;
  };
};

test("electron shell html defines a restrictive CSP meta tag", () => {
  assert.ok(html.includes("Content-Security-Policy"));
  assert.ok(html.includes("default-src 'self'"));
  assert.ok(html.includes("script-src 'self'"));
  assert.ok(html.includes("frame-ancestors 'none'"));
});

test("electron shell package declares runtime and signing build metadata", () => {
  assert.equal(packageJson.devDependencies?.electron, "^35.3.0");
  assert.equal(packageJson.devDependencies?.["electron-updater"], "^6.6.2");
  assert.equal(packageJson.build?.win?.verifyUpdateCodeSignature, true);
  assert.equal(packageJson.build?.win?.signAndEditExecutable, true);
});
