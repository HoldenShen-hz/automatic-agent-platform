#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const pairs = [
  {
    name: "human-takeover-service",
    sync: "src/scale-ecosystem/runtime-services/human-takeover-service.ts",
    async: "src/scale-ecosystem/runtime-services/human-takeover-service-async.ts",
    asyncMirrorNeedle: "PlatformHumanTakeoverServiceAsync",
  },
  {
    name: "execution-dispatch-service",
    sync: "src/scale-ecosystem/runtime-services/execution-dispatch-service.ts",
    async: "src/scale-ecosystem/runtime-services/execution-dispatch-service-async.ts",
    asyncMirrorNeedle: "platform/five-plane-execution/dispatcher/execution-dispatch-service-async",
  },
  {
    name: "execution-worker-handshake-service",
    sync: "src/scale-ecosystem/runtime-services/execution-worker-handshake-service.ts",
    async: "src/scale-ecosystem/runtime-services/execution-worker-handshake-service-async.ts",
    asyncMirrorNeedle: "platform/five-plane-execution/worker-pool/execution-worker-handshake-service-async",
  },
  {
    name: "execution-worker-writeback-service",
    sync: "src/scale-ecosystem/runtime-services/execution-worker-writeback-service.ts",
    async: "src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.ts",
    asyncMirrorNeedle: "platform/five-plane-execution/worker-pool/execution-worker-writeback-service-async",
  },
  {
    name: "durable-event-bus",
    sync: "src/scale-ecosystem/runtime-services/durable-event-bus.ts",
    async: "src/scale-ecosystem/runtime-services/durable-event-bus-async.ts",
    asyncMirrorNeedle: "platform/five-plane-state-evidence/events/durable-event-bus-async",
  },
];

const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function hasTrackedReference(excludedPath, needles) {
  const requiredNeedles = Array.isArray(needles) ? needles : [needles];
  for (const filePath of listFiles(["src", "tests"])) {
    if (filePath === excludedPath) {
      continue;
    }
    const content = readFileSync(filePath, "utf8");
    if (requiredNeedles.some((needle) => content.includes(needle))) {
      return true;
    }
  }
  return false;
}

for (const pair of pairs) {
  const syncSource = readFileSync(pair.sync, "utf8");
  const asyncSource = readFileSync(pair.async, "utf8");
  const syncBase = pair.sync.split("/").at(-1)?.replace(".ts", "") ?? pair.sync;
  const asyncBase = pair.async.split("/").at(-1)?.replace(".ts", "") ?? pair.async;

  check(`${pair.name} async stays a thin platform mirror`, asyncSource.includes(pair.asyncMirrorNeedle), pair.async);
  check(`${pair.name} sync remains referenced`, hasTrackedReference(pair.sync, syncBase), pair.sync);
  check(`${pair.name} async remains referenced`, hasTrackedReference(pair.async, asyncBase), pair.async);
  check(
    `${pair.name} has targeted tests`,
    hasTrackedReference(pair.sync, [syncBase, asyncBase]),
    `${pair.sync} / ${pair.async}`,
  );
  check(
    `${pair.name} sync implementation exports stable class/function surface`,
    /export class|export function|export\s*{[^}]+}\s*from/.test(syncSource),
    pair.sync,
  );
  check(
    `${pair.name} async mirror stays small`,
    asyncSource.split("\n").length <= 160,
    pair.async,
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

function listFiles(roots) {
  const results = [];
  const stack = roots.filter((root) => existsSync(root));
  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null) {
      continue;
    }
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current)) {
        if (entry === "node_modules" || entry === "dist" || entry === ".git") {
          continue;
        }
        stack.push(join(current, entry));
      }
      continue;
    }
    if (stat.isFile() && /\.(ts|tsx|js|jsx|mjs|cjs)$/u.test(current)) {
      results.push(current);
    }
  }
  return results.sort();
}
