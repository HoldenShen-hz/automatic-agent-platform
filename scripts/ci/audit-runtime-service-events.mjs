#!/usr/bin/env node

import { readFileSync } from "node:fs";

const runtimeServiceFiles = [
  "src/scale-ecosystem/runtime-services/durable-event-bus-async.ts",
  "src/scale-ecosystem/runtime-services/execution-dispatch-service-async.ts",
  "src/scale-ecosystem/runtime-services/execution-worker-handshake-service-async.ts",
  "src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.ts",
  "src/scale-ecosystem/runtime-services/human-takeover-service-async.ts",
];

const docs = [
  readFileSync("docs_zh/contracts/event_registry_and_ops_threshold_contract.md", "utf8"),
  readFileSync("docs_en/contracts/event_registry_and_ops_threshold_contract.md", "utf8"),
];

const eventNames = new Set();
for (const path of runtimeServiceFiles) {
  const source = readFileSync(path, "utf8");
  for (const match of source.matchAll(/type:\s*"([a-z_]+)"/g)) {
    eventNames.add(match[1]);
  }
}

const failures = [];
for (const eventName of [...eventNames].sort()) {
  for (const [index, doc] of docs.entries()) {
    if (!doc.includes(`\`${eventName}\``)) {
      failures.push(`missing ${eventName} in ${index === 0 ? "docs_zh" : "docs_en"} runtime-service event registry`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(`runtime-service event audit passed: ${eventNames.size} signals documented`);
