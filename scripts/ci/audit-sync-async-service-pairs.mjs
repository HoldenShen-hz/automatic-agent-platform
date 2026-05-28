#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const pairs = [
  {
    name: "human-takeover-service",
    sync: "src/scale-ecosystem/runtime-services/human-takeover-service.ts",
    async: "src/scale-ecosystem/runtime-services/human-takeover-service-async.ts",
  },
  {
    name: "execution-dispatch-service",
    sync: "src/scale-ecosystem/runtime-services/execution-dispatch-service.ts",
    async: "src/scale-ecosystem/runtime-services/execution-dispatch-service-async.ts",
  },
  {
    name: "execution-worker-handshake-service",
    sync: "src/scale-ecosystem/runtime-services/execution-worker-handshake-service.ts",
    async: "src/scale-ecosystem/runtime-services/execution-worker-handshake-service-async.ts",
  },
  {
    name: "execution-worker-writeback-service",
    sync: "src/scale-ecosystem/runtime-services/execution-worker-writeback-service.ts",
    async: "src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.ts",
  },
];

const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function hasTrackedReference(excludedPath, pattern) {
  const result = spawnSync("rg", ["-n", pattern, "src", "tests", "-g", `!${excludedPath}`], { encoding: "utf8" });
  if (result.error) {
    throw result.error;
  }
  return result.status === 0;
}

for (const pair of pairs) {
  const syncSource = readFileSync(pair.sync, "utf8");
  const asyncSource = readFileSync(pair.async, "utf8");
  const syncBase = pair.sync.split("/").at(-1)?.replace(".ts", "") ?? pair.sync;
  const asyncBase = pair.async.split("/").at(-1)?.replace(".ts", "") ?? pair.async;

  check(`${pair.name} async wraps sync implementation`, asyncSource.includes(syncBase), pair.async);
  check(`${pair.name} sync remains referenced`, hasTrackedReference(pair.sync, syncBase), pair.sync);
  check(`${pair.name} async remains referenced`, hasTrackedReference(pair.async, asyncBase), pair.async);
  check(
    `${pair.name} has targeted tests`,
    hasTrackedReference(pair.sync, `${syncBase}|${asyncBase}`),
    `${pair.sync} / ${pair.async}`,
  );
  check(
    `${pair.name} sync implementation exports stable class/function surface`,
    /export class|export function|export\s*{[^}]+}\s*from/.test(syncSource),
    pair.sync,
  );
}

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

if (failures.length > 0) {
  console.error(`sync/async service pair audit failed: ${failures.length}/${checks.length}`);
  process.exit(1);
}

console.log(`sync/async service pair audit passed: ${checks.length}/${checks.length}`);
