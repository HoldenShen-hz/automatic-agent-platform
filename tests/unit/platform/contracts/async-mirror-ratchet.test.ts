import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SYNC_BACKED_ASYNC_FACADES = [
  "src/scale-ecosystem/billing/billing-service-async.ts",
  "src/scale-ecosystem/intelligence/perception-service-async.ts",
  "src/scale-ecosystem/tenant-platform/data-plane-flow-service-async.ts",
  "src/scale-ecosystem/tenant-platform/tenant-platform-service-async.ts",
  "src/platform/five-plane-execution/dispatcher/execution-dispatch-service-async.ts",
  "src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service-async.ts",
  "src/platform/five-plane-execution/worker-pool/execution-worker-handshake-service-async.ts",
  "src/platform/five-plane-execution/worker-pool/execution-worker-writeback-service-async.ts",
  "src/ops-maturity/drift-detection/evolution-mvp-service-async.ts",
] as const;

test("[SYS-QUAL-7.0] sync-backed async facades use the shared wrapper base", () => {
  for (const file of SYNC_BACKED_ASYNC_FACADES) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /SyncBackedAsyncService/);
    assert.match(source, /extends SyncBackedAsyncService/);
  }
});

test("[SYS-QUAL-7.0] scale-ecosystem async mirrors keep sync counterparts", () => {
  const asyncFiles = [
    "src/scale-ecosystem/billing/billing-service-async.ts",
    "src/scale-ecosystem/intelligence/perception-service-async.ts",
    "src/scale-ecosystem/tenant-platform/data-plane-flow-service-async.ts",
    "src/scale-ecosystem/tenant-platform/tenant-platform-service-async.ts",
    "src/scale-ecosystem/runtime-services/durable-event-bus-async.ts",
    "src/scale-ecosystem/runtime-services/execution-dispatch-service-async.ts",
    "src/scale-ecosystem/runtime-services/execution-worker-handshake-service-async.ts",
    "src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.ts",
    "src/scale-ecosystem/runtime-services/human-takeover-service-async.ts",
  ] as const;

  for (const asyncFile of asyncFiles) {
    const syncFile = asyncFile.replace("-async.ts", ".ts");
    const syncSource = readFileSync(syncFile, "utf8");
    assert.ok(syncSource.trim().length > 0, `missing sync counterpart for ${asyncFile}`);
  }
});
