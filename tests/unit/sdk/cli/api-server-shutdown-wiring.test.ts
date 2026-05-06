import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const apiServerSource = readFileSync(
  join(process.cwd(), "src", "sdk", "cli", "api-server.ts"),
  "utf8",
);

test("api server shutdown wiring cleans typed event bus, model call provider, and process tracker", () => {
  assert.match(apiServerSource, /name: "process_tracker"/);
  assert.match(apiServerSource, /await tracker\.killAll\(\)/);
  assert.match(apiServerSource, /resetProcessTracker\(\)/);
  assert.match(apiServerSource, /name: "model_call_provider"/);
  assert.match(apiServerSource, /resetModelCallProvider\(\)/);
  assert.match(apiServerSource, /name: "typed_event_bus"/);
  assert.match(apiServerSource, /typedEventBus\.dispose\(\)/);
});
