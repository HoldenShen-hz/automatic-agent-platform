import assert from "node:assert/strict";
import test from "node:test";
import { PluginExecutionService } from "../../../../../src/platform/execution/plugin-executor/index.js";
test("PluginExecutionService registers plugins and executes allowed actions", async () => {
    const service = new PluginExecutionService();
    service.register({
        pluginId: "plugin-1",
        actions: ["lint"],
        execute: (request) => ({
            pluginId: request.pluginId,
            action: request.action,
            status: "ok",
            output: { acceptedTenant: request.tenantId },
        }),
    });
    const result = await service.execute({
        pluginId: "plugin-1",
        action: "lint",
        tenantId: "tenant-1",
        payload: {},
    });
    assert.equal(result.status, "ok");
    assert.equal(result.output.acceptedTenant, "tenant-1");
});
//# sourceMappingURL=index.test.js.map