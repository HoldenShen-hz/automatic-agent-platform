import assert from "node:assert/strict";
import test from "node:test";
import { ErasurePlanningService } from "../../../../../src/platform/compliance/erasure/index.js";
test("ErasurePlanningService creates actionable plan and preserves legal hold blocks", () => {
    const service = new ErasurePlanningService();
    const plan = service.createPlan({
        subjectRef: "user:alice",
        requestedBy: "privacy@example.com",
        slaHours: 24,
        targets: [
            { targetRef: "memory:1", targetKind: "memory", containsPii: true },
            { targetRef: "backup:1", targetKind: "backup", containsPii: true, backupCopy: true },
            { targetRef: "artifact:legal", targetKind: "artifact", containsPii: true, legalHold: true },
        ],
    });
    assert.equal(plan.steps[0]?.action, "erase");
    assert.equal(plan.steps[1]?.action, "redact");
    assert.equal(plan.steps[2]?.action, "hold");
    assert.equal(plan.status, "blocked_by_legal_hold");
});
//# sourceMappingURL=index.test.js.map