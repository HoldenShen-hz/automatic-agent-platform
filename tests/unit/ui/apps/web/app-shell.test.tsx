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
  assert.ok(source.includes("const resolvedAuthenticated = authContext?.authenticated ?? locationAuthContext.authenticated ?? false;"));
  assert.ok(source.includes("...createFeatureGuardContext({"));
  assert.ok(source.includes("...locationAuthContext,"));
  assert.ok(source.includes("...authContext,"));
  assert.ok(source.includes("authenticated: resolvedAuthenticated,"));
});

test("WebAppShell forwards auth context into the runtime provider and frame", () => {
  assert.ok(source.includes("<UiRuntimeProvider {...runtimeProps} authContext={runtimeAuthContext}>"));
  assert.ok(source.includes("authContext={effectiveAuthContext}"));
  assert.ok(source.includes("...(effectiveAuthContext.tenantId == null ? {} : { tenantId: effectiveAuthContext.tenantId })"));
});
