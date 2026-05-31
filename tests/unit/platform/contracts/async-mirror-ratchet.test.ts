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
  const mirrors = [
    {
      asyncFile: "src/scale-ecosystem/runtime-services/durable-event-bus-async.ts",
      sourceNeedle: "platform/five-plane-state-evidence/events/durable-event-bus-async",
    },
    {
      asyncFile: "src/scale-ecosystem/runtime-services/execution-dispatch-service-async.ts",
      sourceNeedle: "platform/five-plane-execution/dispatcher/execution-dispatch-service-async",
    },
    {
      asyncFile: "src/scale-ecosystem/runtime-services/execution-worker-handshake-service-async.ts",
      sourceNeedle: "platform/five-plane-execution/worker-pool/execution-worker-handshake-service-async",
    },
    {
      asyncFile: "src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.ts",
      sourceNeedle: "platform/five-plane-execution/worker-pool/execution-worker-writeback-service-async",
    },
    {
      asyncFile: "src/scale-ecosystem/runtime-services/human-takeover-service-async.ts",
      sourceNeedle: "PlatformHumanTakeoverServiceAsync",
    },
  ] as const;

  for (const mirror of mirrors) {
    const source = readFileSync(mirror.asyncFile, "utf8");
    assert.match(source, new RegExp(mirror.sourceNeedle));
    assert.ok(source.split("\n").length <= 160, `${mirror.asyncFile} should stay a thin mirror`);
  }
});
