import assert from "node:assert/strict";
import test from "node:test";

import { parseCursor } from "../../../../src/sdk/client-sdk/api-client.js";

test("2291: parseCursor rejects unexpected properties", () => {
  const encoded = Buffer.from(JSON.stringify({
    cursor: "page-1",
    limit: 25,
    tenantId: "tenant-1",
  })).toString("base64");
  assert.equal(parseCursor(encoded), undefined);
});

test("2291: parseCursor rejects non-integer limits", () => {
  const encoded = Buffer.from(JSON.stringify({
    cursor: "page-1",
    limit: 1.5,
  })).toString("base64");
  assert.equal(parseCursor(encoded), undefined);
});
