import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(process.cwd(), "src", "sdk", "admin-sdk", "index.ts"),
  "utf8",
);

test("2285: AdminSdk exposes bulk operations with transaction-semantics contract", () => {
  assert.match(source, /bulkCreateTenants/);
  assert.match(source, /bulkUpdateTenants/);
  assert.match(source, /bulkDeleteTenants/);
  assert.match(source, /bulkCreatePolicies/);
  assert.match(source, /bulkAttachPolicies/);
  assert.match(source, /bulkDomainLifecycle/);
  assert.match(source, /transactional semantics/);
  assert.match(source, /\/tenants\/bulk/);
  assert.match(source, /\/policies\/bulk/);
  assert.match(source, /\/domains\/lifecycle\/bulk/);
});
