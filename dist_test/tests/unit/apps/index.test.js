import assert from "node:assert/strict";
import test from "node:test";
import { listPlatformApps } from "../../../src/apps/index.js";
test("listPlatformApps returns the canonical app manifests", () => {
    const apps = listPlatformApps();
    assert.equal(apps.length, 3);
    assert.deepEqual(apps.map((app) => app.kind), ["api", "console", "worker"]);
});
//# sourceMappingURL=index.test.js.map