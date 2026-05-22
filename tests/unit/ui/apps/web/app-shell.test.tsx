import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { resolveRepoPath } from "../../../../helpers/repo-root.js";

const source = fs.readFileSync(
  resolveRepoPath("ui/apps/web/src/app-shell.tsx"),
  "utf-8",
);

test("WebAppShell no longer defines a hardcoded demo guard context", () => {
  assert.equal(source.includes("const demoGuardContext"), false);
  assert.ok(source.includes("createFeatureGuardContext"));
  assert.ok(source.includes("authenticated: authContext !== null"));
  assert.ok(source.includes("permissions: authContext?.permissions ?? []"));
  assert.ok(source.includes("roles: authContext?.roles ?? []"));
  assert.ok(source.includes("tenantId: authContext?.tenantId ?? \"\""));
});

test("WebAppShell forwards auth context into the runtime provider and frame", () => {
  assert.ok(source.includes("...(authContext == null ? {} : { authContext })"));
  assert.ok(source.includes("<AppFrame features={features} authContext={authContext ?? null} />"));
});
