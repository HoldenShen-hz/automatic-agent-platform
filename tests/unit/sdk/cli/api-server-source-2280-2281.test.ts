import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = readFileSync(
  join(process.cwd(), "src", "sdk", "cli", "api-server.ts"),
  "utf-8",
);

test("2280: api-server startup remains fail-closed when auth is absent", () => {
  assert.match(
    source,
    /server cannot start with all endpoints unprotected/,
  );
  assert.match(
    source,
    /AA_API_KEYS|AA_JWT_SECRET|AA_API_JWT_SECRET/,
  );
});

test("2281: api-server retains webhook secret entropy guards", () => {
  assert.match(source, /AA_WEBHOOK_SECRET must be at least/);
  assert.match(source, /AA_WEBHOOK_SECRET cannot be empty/);
});
