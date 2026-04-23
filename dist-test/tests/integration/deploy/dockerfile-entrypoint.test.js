import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
test("[SYS-DEPLOY-6.3] Dockerfile CMD entrypoint exists after build", () => {
    const dockerfilePath = resolve("Dockerfile");
    const content = readFileSync(dockerfilePath, "utf8");
    // Match CMD with node executable - handle multi-word arrays like:
    // CMD ["node", "--enable-source-maps", "dist/src/sdk/cli/api-server.js"]
    const cmdMatch = content.match(/CMD\s*\[\s*"node"\s*,\s*"[^"]*"\s*,\s*"([^"]+)"\s*\]/);
    assert.ok(cmdMatch, "Dockerfile must have a CMD with node executable and a dist/ path");
    const entrypoint = cmdMatch[1];
    assert.ok(existsSync(resolve(entrypoint)), `CMD entrypoint "${entrypoint}" must exist after build`);
});
//# sourceMappingURL=dockerfile-entrypoint.test.js.map