import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

test("[SYS-DEPLOY-6.3] Dockerfile CMD entrypoint exists after build", () => {
  const dockerfilePath = resolve("Dockerfile");
  const content = readFileSync(dockerfilePath, "utf8");
  const cmdMatch = content.match(/CMD\s+\["node"[^]]*?"(dist\/[^"]+)"/);
  assert.ok(cmdMatch, "Dockerfile must have a CMD with a dist/ path");
  const entrypoint = cmdMatch[1];
  assert.ok(
    existsSync(resolve(entrypoint)),
    `CMD entrypoint "${entrypoint}" must exist after build`
  );
});
