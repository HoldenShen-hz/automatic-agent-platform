import assert from "node:assert/strict";
import type { TestContext } from "node:test";

export function reportSoftPerformanceMiss(t: TestContext, error: unknown): void {
  if (error instanceof assert.AssertionError) {
    t.diagnostic(`performance soft miss: ${error.message}`);
    return;
  }
  throw error;
}

export function failOnListenSocketDenied(error: unknown): never {
  if ((error as NodeJS.ErrnoException).code === "EPERM") {
    assert.fail("local listen sockets are required for this network-path test");
  }
  throw error;
}
