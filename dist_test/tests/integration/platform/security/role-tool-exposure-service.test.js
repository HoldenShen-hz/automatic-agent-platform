import assert from "node:assert/strict";
import test from "node:test";
import { RoleToolExposureService } from "../../../../src/platform/execution/tool-executor/role-tool-exposure-service.js";
test("role tool exposure service does not promote undeclared tools into the visible set", () => {
    const service = new RoleToolExposureService();
    const result = service.resolve({
        divisionId: "general_ops",
        roleId: "general_executor",
        taskContext: "Apply a patch to the repository and then continue.",
        promoteToolNames: ["apply_patch"],
    });
    assert.deepEqual(result.resolvedToolNames, ["read", "bash"]);
    assert.deepEqual(result.visibleToolNames, ["read", "bash"]);
    assert.equal(result.visibleToolNames.includes("apply_patch"), false);
});
//# sourceMappingURL=role-tool-exposure-service.test.js.map