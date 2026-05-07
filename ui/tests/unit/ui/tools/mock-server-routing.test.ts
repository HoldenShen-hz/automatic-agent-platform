import assert from "node:assert/strict";
import test from "node:test";

import { resolveMockRequest } from "../../../../tools/mock-server/src/index.js";

test("resolveMockRequest matches exact task routes without leaking into similarly prefixed paths", () => {
  const tasks = resolveMockRequest("/api/v1/tasks");
  const archived = resolveMockRequest("/api/v1/tasks-archive");

  assert.notDeepEqual(tasks, archived);
  assert.deepEqual(archived, {
    ok: true,
    path: "/api/v1/tasks-archive",
  });
});

test("resolveMockRequest ignores query strings when resolving canonical routes", () => {
  const result = resolveMockRequest("/api/v1/meta/contract-version?verbose=true");
  assert.deepEqual(result, {
    contractVersion: "1.0",
    minServerVersion: "1.0",
    supportedVersions: ["1.0"],
  });
});
