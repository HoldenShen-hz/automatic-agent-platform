import assert from "node:assert/strict";
import test from "node:test";

import { CertificationStatusSchema } from "../../../../../src/scale-ecosystem/marketplace/certification/index.js";

test("CertificationStatusSchema accepts reviewing, published, and suspended states", () => {
  assert.equal(CertificationStatusSchema.parse("reviewing"), "reviewing");
  assert.equal(CertificationStatusSchema.parse("published"), "published");
  assert.equal(CertificationStatusSchema.parse("suspended"), "suspended");
});
