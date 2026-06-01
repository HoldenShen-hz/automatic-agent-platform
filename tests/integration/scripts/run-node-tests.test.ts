import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNodeTestArgs,
  DEFAULT_NODE_TEST_CONCURRENCY,
  readNodeTestConcurrency,
} from "../../../scripts/run-node-tests.mjs";

test("run-node-tests defaults to 12-way test concurrency", () => {
  assert.equal(DEFAULT_NODE_TEST_CONCURRENCY, 12);
  assert.equal(readNodeTestConcurrency({}), 12);
  assert.deepEqual(
    buildNodeTestArgs(["tests/unit/example.test.ts"], {}),
    [
      "--import",
      "tsx",
      "--test",
      "--test-concurrency=12",
      "tests/unit/example.test.ts",
    ],
  );
});

test("run-node-tests accepts explicit concurrency overrides", () => {
  assert.equal(readNodeTestConcurrency({ AA_NODE_TEST_CONCURRENCY: "3" }), 3);
  assert.deepEqual(
    buildNodeTestArgs(["tests/unit/example.test.ts"], { AA_NODE_TEST_CONCURRENCY: "3" }),
    [
      "--import",
      "tsx",
      "--test",
      "--test-concurrency=3",
      "tests/unit/example.test.ts",
    ],
  );
});
