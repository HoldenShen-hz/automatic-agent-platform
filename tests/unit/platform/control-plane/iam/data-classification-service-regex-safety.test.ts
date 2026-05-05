import assert from "node:assert/strict";
import test from "node:test";

import { DataClassificationService } from "../../../../../src/platform/control-plane/iam/data-classification-service.js";

test("DataClassificationService ignores unsafe custom regex rules instead of evaluating them", () => {
  const service = new DataClassificationService();
  service.defineRule({
    name: "unsafe-regex",
    level: "restricted",
    patterns: ["(a+)+$"],
    keywords: [],
    autoClassify: true,
  });

  const result = service.classify("aaaaaaaaaaaaaaaaaaaaaaaaaaaa!");

  assert.equal(result.level, "public");
  assert.notEqual(result.reasoning, "rule_match:unsafe-regex");
});
