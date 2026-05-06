import assert from "node:assert/strict";
import test from "node:test";

import { getFxRateProvider } from "../../../../src/org-governance/approval-routing/route-engine/index.js";

test("route engine FX provider uses configured USD to CNY rate instead of hardcoded 7.2", async () => {
  const previousRate = process.env["APPROVAL_ROUTE_USD_CNY_RATE"];
  const previousSource = process.env["APPROVAL_ROUTE_FX_RATE_SOURCE"];

  process.env["APPROVAL_ROUTE_USD_CNY_RATE"] = "6.91";
  process.env["APPROVAL_ROUTE_FX_RATE_SOURCE"] = "test_env_rate";

  try {
    const rate = await getFxRateProvider().getRate("USD", "CNY");
    assert.equal(rate, 6.91);
  } finally {
    if (previousRate === undefined) {
      delete process.env["APPROVAL_ROUTE_USD_CNY_RATE"];
    } else {
      process.env["APPROVAL_ROUTE_USD_CNY_RATE"] = previousRate;
    }
    if (previousSource === undefined) {
      delete process.env["APPROVAL_ROUTE_FX_RATE_SOURCE"];
    } else {
      process.env["APPROVAL_ROUTE_FX_RATE_SOURCE"] = previousSource;
    }
  }
});
