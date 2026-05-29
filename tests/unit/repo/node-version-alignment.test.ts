import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("repo keeps engines, Dockerfile, and CI node versions aligned", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    engines?: { node?: string };
  };
  const dockerfile = readFileSync("Dockerfile", "utf8");
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

  assert.equal(packageJson.engines?.node, ">=22 <23");
  assert.match(dockerfile, /FROM node:22\.21\.1-bookworm-slim@sha256:[0-9a-f]{64} AS build/);
  assert.match(dockerfile, /FROM node:22\.21\.1-bookworm-slim@sha256:[0-9a-f]{64} AS runtime/);
  assert.match(workflow, /node-version: 22/);
});
