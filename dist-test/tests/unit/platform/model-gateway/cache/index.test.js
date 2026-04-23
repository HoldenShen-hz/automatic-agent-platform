import assert from "node:assert/strict";
import test from "node:test";
import { ModelGatewayCacheService } from "../../../../../src/platform/model-gateway/cache/index.js";
test("ModelGatewayCacheService builds stable keys and expires entries", () => {
    const service = new ModelGatewayCacheService();
    const cacheKey = service.buildCacheKey({
        tenantId: "tenant-1",
        model: "gpt-5.4",
        routeClass: "reasoning",
        messages: [{ role: "user", content: " Hello " }],
    });
    service.put({
        cacheKey,
        tenantId: "tenant-1",
        model: "gpt-5.4",
        routeClass: "reasoning",
        value: { text: "cached" },
        createdAt: "2026-04-20T00:00:00.000Z",
        ttlMs: 1000,
    });
    assert.equal(service.get(cacheKey, "2026-04-20T00:00:00.500Z")?.value.text, "cached");
    assert.equal(service.get(cacheKey, "2026-04-20T00:00:02.000Z"), null);
});
//# sourceMappingURL=index.test.js.map