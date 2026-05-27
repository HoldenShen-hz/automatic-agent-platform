import assert from "node:assert/strict";
import test from "node:test";

import { GracefulShutdown } from "../../../../../src/platform/five-plane-execution/startup/graceful-shutdown.js";

test("graceful shutdown executes handlers using dependsOn ordering [graceful-shutdown-dependency-order]", async () => {
  const callOrder: string[] = [];
  const shutdown = new GracefulShutdown({
    registerSignalHandlers: false,
    timeoutMs: 5_000,
  });

  shutdown.addHandler({
    name: "close",
    dependsOn: ["flush"],
    handler: async () => {
      callOrder.push("close");
    },
  });
  shutdown.addHandler({
    name: "flush",
    dependsOn: ["drain"],
    handler: async () => {
      callOrder.push("flush");
    },
  });
  shutdown.addHandler({
    name: "drain",
    handler: async () => {
      callOrder.push("drain");
    },
  });

  const result = await shutdown.shutdown();

  assert.equal(result.success, true);
  assert.deepStrictEqual(callOrder, ["close", "flush", "drain"]);

  shutdown.reset();
});
