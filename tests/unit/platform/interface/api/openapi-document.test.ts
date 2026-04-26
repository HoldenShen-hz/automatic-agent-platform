import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOpenApiDocument,
  listApiRoutes,
} from "../../../../src/platform/interface/api/openapi-document.js";

test("buildOpenApiDocument returns valid OpenAPI structure", () => {
  const doc = buildOpenApiDocument();
  assert.equal(doc.openapi, "3.1.0");
  assert.equal(doc.info.title, "Automatic Agent API");
  assert.equal(doc.info.version, "0.1.0");
});
