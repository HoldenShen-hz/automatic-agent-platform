import assert from "node:assert/strict";
import test from "node:test";

import { AUTHORITATIVE_SCHEMA_SQL } from "../../../../../../src/platform/five-plane-state-evidence/truth/sql/authoritative-schema.js";

test("authoritative schema includes phase 1A part 5 storage tables", () => {
  assert.match(AUTHORITATIVE_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS tenants \(/);
  assert.match(AUTHORITATIVE_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS delegations \(/);
  assert.match(AUTHORITATIVE_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS cost_reports \(/);
  assert.match(AUTHORITATIVE_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS marketplace_listings \(/);
  assert.match(AUTHORITATIVE_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS prompt_bundles \(/);
});
