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
    const builtEntrypoint = resolve(entrypoint);
    const sourceEntrypoint = resolve(entrypoint
        .replace(/^dist\//, "src/")
        .replace(/\.js$/, ".ts"));
    assert.ok(existsSync(builtEntrypoint) || existsSync(sourceEntrypoint), `CMD entrypoint "${entrypoint}" must map to an existing built or source module`);
});
//# sourceMappingURL=dockerfile-entrypoint.test.js.map