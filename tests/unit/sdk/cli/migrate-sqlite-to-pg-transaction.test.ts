import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(process.cwd(), "src", "sdk", "cli", "migrate-sqlite-to-pg.ts"),
  "utf-8",
);

test("2288: migrateSqliteToPg wraps cross-table writeback in one PostgreSQL transaction", () => {
  assert.match(source, /await pg\.transaction\(async \(conn\) => \{/);
  assert.match(source, /SELECT \* FROM \$\{table\} LIMIT \? OFFSET \?/);
  assert.doesNotMatch(source, /SELECT \* FROM \$\{table\}`\)\.all\(\)/);
});
