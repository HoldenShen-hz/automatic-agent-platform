import assert from "node:assert/strict";
import test from "node:test";
import { decideWorkflowStepRetry, } from "../../../../../../src/platform/orchestration/oapeflir/workflow/workflow-step-retry-policy.js";
test("decideWorkflowStepRetry classifies transient errors correctly", () => {
    const result = decideWorkflowStepRetry({
        errorCode: "provider.rate_limited",
        attempt: 1,
        maxAttempts: 3,
    });
    assert.equal(result.failureClass, "transient");
    assert.equal(result.action, "retry");
    assert.equal(result.retryable, true);
    assert.equal(result.backoff, "exponential");
});
test("decideWorkflowStepRetry classifies semantic errors correctly", () => {
    const result = decideWorkflowStepRetry({
        errorCode: "validation.schema_mismatch",
        attempt: 1,
        maxAttempts: 3,
    });
    assert.equal(result.failureClass, "semantic");
    assert.equal(result.action, "retry");
    assert.equal(result.retryable, true);
    assert.equal(result.backoff, "fixed");
});
test("decideWorkflowStepRetry classifies permission errors correctly", () => {
    const result = decideWorkflowStepRetry({
        errorCode: "auth.permission_denied",
        attempt: 1,
        maxAttempts: 3,
    });
    assert.equal(result.failureClass, "permission");
    assert.equal(result.action, "fail");
    assert.equal(result.retryable, false);
});
test("decideWorkflowStepRetry classifies destructive errors as escalate", () => {
    const result = decideWorkflowStepRetry({
        errorCode: "policy.approval_required",
        attempt: 1,
        maxAttempts: 3,
    });
    assert.equal(result.failureClass, "destructive");
    assert.equal(result.action, "escalate");
    assert.equal(result.retryable, false);
});
test("decideWorkflowStepRetry classifies unknown errors as non_retryable", () => {
    const result = decideWorkflowStepRetry({
        errorCode: "unknown.error",
        attempt: 1,
        maxAttempts: 3,
    });
    assert.equal(result.failureClass, "non_retryable");
    assert.equal(result.action, "fail");
    assert.equal(result.retryable, false);
});
test("decideWorkflowStepRetry fails when max attempts reached for transient", () => {
    const result = decideWorkflowStepRetry({
        errorCode: "provider.rate_limited",
        attempt: 3,
        maxAttempts: 3,
    });
    assert.equal(result.failureClass, "transient");
    assert.equal(result.action, "fail");
    assert.equal(result.retryable, false);
});
test("decideWorkflowStepRetry computes exponential backoff for transient", () => {
    const attempt1 = decideWorkflowStepRetry({
        errorCode: "provider.rate_limited",
        attempt: 1,
        maxAttempts: 5,
    });
    assert.equal(attempt1.retryDelayMs, 500); // 500 * 2^0 = 500
    const attempt2 = decideWorkflowStepRetry({
        errorCode: "provider.rate_limited",
        attempt: 2,
        maxAttempts: 5,
    });
    assert.equal(attempt2.retryDelayMs, 1000); // 500 * 2^1 = 1000
    const attempt3 = decideWorkflowStepRetry({
        errorCode: "provider.rate_limited",
        attempt: 3,
        maxAttempts: 5,
    });
    assert.equal(attempt3.retryDelayMs, 2000); // 500 * 2^2 = 2000
    const attempt4 = decideWorkflowStepRetry({
        errorCode: "provider.rate_limited",
        attempt: 4,
        maxAttempts: 5,
    });
    assert.equal(attempt4.retryDelayMs, 4000); // 500 * 2^3 = 4000
    // attempt 5 has maxAttempts 6 so canRetry = (5 < 6) = true
    const attempt5 = decideWorkflowStepRetry({
        errorCode: "provider.rate_limited",
        attempt: 5,
        maxAttempts: 6,
    });
    assert.equal(attempt5.retryDelayMs, 8000); // 500 * 2^4 = 8000
    // attempt 6 has maxAttempts 6 so canRetry = (6 < 6) = false - returns fail
    const attempt6 = decideWorkflowStepRetry({
        errorCode: "provider.rate_limited",
        attempt: 6,
        maxAttempts: 6,
    });
    assert.equal(attempt6.retryDelayMs, 0); // capped - no retry
    assert.equal(attempt6.action, "fail");
});
test("decideWorkflowStepRetry uses fixed delay for semantic errors", () => {
    const result = decideWorkflowStepRetry({
        errorCode: "validation.schema_mismatch",
        attempt: 1,
        maxAttempts: 3,
    });
    assert.equal(result.retryDelayMs, 0);
});
test("decideWorkflowStepRetry returns correct errorCode in decision", () => {
    const result = decideWorkflowStepRetry({
        errorCode: "provider.rate_limited",
        attempt: 1,
        maxAttempts: 3,
    });
    assert.equal(result.errorCode, "provider.rate_limited");
});
test("decideWorkflowStepRetry permission errors are not retryable", () => {
    const errorCodes = [
        "auth.permission_denied",
        "policy.action_denied",
        "validation.invalid_input",
        "budget.budget_exceeded",
        "budget.quota_exceeded",
        "sandbox.path_denied",
        "sandbox.network_denied",
        "sandbox.exec_denied",
        "sandbox.isolation_broken",
        "tenant.boundary_violation",
        "tenant.workspace_mismatch",
    ];
    for (const errorCode of errorCodes) {
        const result = decideWorkflowStepRetry({
            errorCode,
            attempt: 1,
            maxAttempts: 3,
        });
        assert.equal(result.failureClass, "permission", `${errorCode} should be permission`);
        assert.equal(result.retryable, false, `${errorCode} should not be retryable`);
    }
});
test("decideWorkflowStepRetry transient errors include expected codes", () => {
    const errorCodes = [
        "provider.rate_limited",
        "provider.temporary_unavailable",
        "provider.compaction_unavailable",
        "tool.temporary_io_error",
        "tool.file_lock_conflict",
        "tool.file_lock_timeout",
        "storage.write_failed",
        "workflow.dependency_unavailable",
        "runtime.recovery_required",
        "runtime.stale_lock_detected",
        "external.service_unavailable",
    ];
    for (const errorCode of errorCodes) {
        const result = decideWorkflowStepRetry({
            errorCode,
            attempt: 1,
            maxAttempts: 3,
        });
        assert.equal(result.failureClass, "transient", `${errorCode} should be transient`);
        assert.equal(result.retryable, true, `${errorCode} should be retryable`);
    }
});
test("decideWorkflowStepRetry semantic errors include expected codes", () => {
    const errorCodes = [
        "validation.schema_mismatch",
        "runtime.context_overflow",
    ];
    for (const errorCode of errorCodes) {
        const result = decideWorkflowStepRetry({
            errorCode,
            attempt: 1,
            maxAttempts: 3,
        });
        assert.equal(result.failureClass, "semantic", `${errorCode} should be semantic`);
        assert.equal(result.retryable, true, `${errorCode} should be retryable`);
    }
});
test("decideWorkflowStepRetry action is fail for permission with no attempts left", () => {
    const result = decideWorkflowStepRetry({
        errorCode: "auth.permission_denied",
        attempt: 3,
        maxAttempts: 3,
    });
    assert.equal(result.action, "fail");
    assert.equal(result.retryable, false);
});
test("decideWorkflowStepRetry action is escalate for destructive regardless of attempts", () => {
    const result = decideWorkflowStepRetry({
        errorCode: "policy.approval_required",
        attempt: 1,
        maxAttempts: 10,
    });
    assert.equal(result.action, "escalate");
    assert.equal(result.retryable, false);
});
test("decideWorkflowStepRetry backoff is none for permission errors", () => {
    const result = decideWorkflowStepRetry({
        errorCode: "auth.permission_denied",
        attempt: 1,
        maxAttempts: 3,
    });
    assert.equal(result.backoff, "none");
});
//# sourceMappingURL=workflow-step-retry-policy.test.js.map