import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { resolveRepoPath } from "../../../../helpers/repo-root.js";

import { mobileShellManifest } from "../../../../../ui/apps/mobile/src/index.js";

const appSource = fs.readFileSync(
  resolveRepoPath("ui/apps/mobile/src/App.tsx"),
  "utf-8",
);
const packageJson = JSON.parse(
  fs.readFileSync(
    resolveRepoPath("ui/apps/mobile/package.json"),
    "utf-8",
  ),
) as {
  dependencies?: Record<string, string>;
};

test("MobileApp detects iOS before falling back to android", () => {
  assert.ok(appSource.includes("Platform.OS === \"ios\""));
  assert.ok(appSource.includes("Platform.OS === \"android\""));
  assert.ok(appSource.includes("return /iphone|ipad|ipod|ios/.test(userAgent) ? \"ios\" : \"android\";"));
  assert.equal(appSource.includes("createMobilePlatformAdapter(\"android\")"), false);
});

test("MobileApp still builds a React element from the detected platform adapter", () => {
  assert.ok(appSource.includes("export function MobileApp(): ReactElement"));
  assert.ok(appSource.includes("const adapter = useMemo(() => createMobilePlatformAdapter(platform), [platform]);"));
});

test("mobile shell manifest advertises both android and ios", () => {
  assert.equal(mobileShellManifest.runtime, "react-native");
  assert.deepEqual(mobileShellManifest.platforms, ["android", "ios"]);
});

test("mobile package declares react-native runtime dependency", () => {
  assert.equal(packageJson.dependencies?.react, "^19.1.0");
  assert.equal(packageJson.dependencies?.["react-native"], ">=0.79 <1");
});
