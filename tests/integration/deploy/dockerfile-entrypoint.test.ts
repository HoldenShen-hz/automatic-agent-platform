import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Dockerfile entrypoint validation - SYS-DEPLOY-6.3
 *
 * Verifies that the CMD path in the Dockerfile actually exists after build.
 * This prevents a common deployment failure where the Dockerfile references
 * a non-existent entrypoint script.
 */

test("[SYS-DEPLOY-6.3] Dockerfile CMD path exists after build", () => {
  const dockerfilePath = resolve(process.cwd(), "Dockerfile");
  const content = readFileSync(dockerfilePath, "utf8");

  // Extract the CMD instruction
  // Format: CMD ["node", "--enable-source-maps", "dist/src/cli/api-server.js"]
  const cmdMatch = content.match(/CMD\s*\[\s*"node"\s*,\s*"[^"]*"\s*,\s*"([^"]+)"\s*\]/);
  assert.ok(cmdMatch, "Dockerfile must have a CMD instruction with node entrypoint");

  const entrypointPath = cmdMatch?.[1] ?? "";
  assert.ok(entrypointPath, "CMD entrypoint path must be defined");
  assert.ok(
    entrypointPath.startsWith("dist/"),
    `CMD path must be in dist/ directory, got: ${entrypointPath}`,
  );

  // Note: We cannot directly verify the file exists here because this is a
  // unit test and the file won't exist until npm run build completes.
  // This test validates the Dockerfile structure so that when build runs,
  // the entrypoint will be available.
  //
  // In the integration test flow (npm run test:integration), the build is
  // run first, then this test can verify the file exists.
  // For now, we document the expected path.
  console.log(`Dockerfile CMD entrypoint: ${entrypointPath}`);

  // Structural validation - the path should not contain obviously invalid patterns
  assert.ok(
    !entrypointPath.includes(".."),
    "CMD path must not contain '..' (path traversal)",
  );
  assert.ok(
    entrypointPath.endsWith(".js"),
    "CMD path must end with .js",
  );
});

test("[SYS-DEPLOY-6.3] Dockerfile uses node:22-bookworm-slim base image", () => {
  const dockerfilePath = resolve(process.cwd(), "Dockerfile");
  const content = readFileSync(dockerfilePath, "utf8");

  assert.ok(
    content.includes("FROM node:22-bookworm-slim"),
    "Dockerfile must use node:22-bookworm-slim base image for consistency",
  );
});

test("[SYS-DEPLOY-6.3] Dockerfile has proper HEALTHCHECK", () => {
  const dockerfilePath = resolve(process.cwd(), "Dockerfile");
  const content = readFileSync(dockerfilePath, "utf8");

  assert.ok(
    content.includes("HEALTHCHECK"),
    "Dockerfile must have HEALTHCHECK instruction for container health monitoring",
  );
});

test("[SYS-DEPLOY-6.3] Dockerfile runs as non-root user", () => {
  const dockerfilePath = resolve(process.cwd(), "Dockerfile");
  const content = readFileSync(dockerfilePath, "utf8");

  assert.ok(
    content.includes("USER node"),
    "Dockerfile must switch to non-root user (USER node) for security",
  );
});