import { describe, it } from "node:test";
import assert from "node:assert";

describe("Ops Core", () => {
  it("executes query", async () => {
    const { handleQuery } = await import("../src/index.js");
    const result = await handleQuery({ query: "test" });
    assert.ok(result.result);
  });
});