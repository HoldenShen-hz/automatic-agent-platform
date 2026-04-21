import { describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createTempWorkspace, cleanupPath } from "../../../../../tests/helpers/fs.js";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";

describe("StructuredLogger Performance", () => {
  test("[SYS-PERF-3.1] structured logger write does not block event loop > 1ms", () => {
    const workspace = createTempWorkspace("aa-logger-");
    try {
      const logger = new StructuredLogger({ retentionLimit: 1000 });
      StructuredLogger.configureGlobalFileSink(path.join(workspace, "test.log"));

      const iterations = 100;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        logger.info(`test message ${i}`);
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;
      assert.ok(avgMs < 1, `Average log write ${avgMs.toFixed(3)}ms must be < 1ms`);
    } finally {
      StructuredLogger.configureGlobalFileSink(null);
      cleanupPath(workspace);
    }
  });
});