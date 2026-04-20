/**
 * Unit tests for failover-controller
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */

import assert from "node:assert/strict";
import test from "node:test";
import { resolveRegionFailover, type RegionFailoverInput } from "../../../../src/scale-ecosystem/multi-region/failover-controller/index.js";

test("resolveRegionFailover returns no failover when primary is healthy", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["eu-west", "ap-south"],
  };

  const decision = resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
});

test("resolveRegionFailover returns failover when primary is unhealthy", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["eu-west", "ap-south"],
  };

  const decision = resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "eu-west"); // First candidate
});

test("resolveRegionFailover returns no failover when no candidates", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: [],
  };

  const decision = resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
});

test("resolveRegionFailover returns null target when empty candidates despite unhealthy primary", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: [],
  };

  const decision = resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, false);
});

test("resolveRegionFailover selects first candidate when primary is unhealthy", () => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["region-a", "region-b", "region-c"],
  };

  const decision = resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "region-a");
});
