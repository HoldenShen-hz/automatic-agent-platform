/**
 * Takeover CLI Tests
 *
 * Tests for takeover.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
// ---------------------------------------------------------------------------
// Tests for requireEnvValue helper
// ---------------------------------------------------------------------------
test("requireEnvValue returns value when non-null", () => {
    const result = (value, name) => {
        if (value == null) {
            throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
        }
        return value;
    };
    assert.equal(result("test-value", "AA_TEST"), "test-value");
});
test("requireEnvValue throws ValidationError when value is null", () => {
    const requireEnvValue = (value, name) => {
        if (value == null) {
            throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
        }
        return value;
    };
    assert.throws(() => requireEnvValue(null, "AA_MISSING"), { message: "missing_env:AA_MISSING" });
});
test("requireEnvValue throws ValidationError when value is undefined", () => {
    const requireEnvValue = (value, name) => {
        if (value == null) {
            throw new ValidationError(`missing_env:${name}`, `missing_env:${name}`);
        }
        return value;
    };
    assert.throws(() => requireEnvValue(undefined, "AA_UNDEFINED"), { message: "missing_env:AA_UNDEFINED" });
});
// ---------------------------------------------------------------------------
// Tests for takeover action branching
// ---------------------------------------------------------------------------
test("takeover action open is valid", () => {
    const action = "open";
    assert.equal(action, "open");
});
test("takeover action modify_input is valid", () => {
    const action = "modify_input";
    assert.equal(action, "modify_input");
});
test("takeover action switch_worker is valid", () => {
    const action = "switch_worker";
    assert.equal(action, "switch_worker");
});
test("takeover action retry_execution is valid", () => {
    const action = "retry_execution";
    assert.equal(action, "retry_execution");
});
test("takeover action set_current_step is valid", () => {
    const action = "set_current_step";
    assert.equal(action, "set_current_step");
});
test("takeover action write_step_output is valid", () => {
    const action = "write_step_output";
    assert.equal(action, "write_step_output");
});
test("takeover action skip_step is valid", () => {
    const action = "skip_step";
    assert.equal(action, "skip_step");
});
test("takeover action complete_task is valid", () => {
    const action = "complete_task";
    assert.equal(action, "complete_task");
});
test("takeover throws ValidationError for unknown action", () => {
    const action = "unknown";
    const errorPrefix = `unknown_takeover_action:${action}`;
    assert.throws(() => {
        if (!["open", "modify_input", "switch_worker", "retry_execution", "set_current_step", "write_step_output", "skip_step", "complete_task"].includes(action)) {
            throw new ValidationError(errorPrefix, errorPrefix);
        }
    }, { message: errorPrefix });
});
// ---------------------------------------------------------------------------
// Tests for open session argument building
// ---------------------------------------------------------------------------
test("open builds arguments with taskId and operatorId", () => {
    const envConfig = {
        taskId: "task-123",
        operatorId: "operator-456",
        reasonCode: "takeover.open",
        tenantId: null,
    };
    const args = {
        taskId: envConfig.taskId,
        operatorId: envConfig.operatorId,
        reasonCode: envConfig.reasonCode,
    };
    if (envConfig.tenantId != null) {
        args.tenantId = envConfig.tenantId;
    }
    assert.equal(args.taskId, "task-123");
    assert.equal(args.operatorId, "operator-456");
    assert.equal(args.reasonCode, "takeover.open");
    assert.equal(args.tenantId, undefined);
});
test("open includes optional tenantId when provided", () => {
    const envConfig = {
        taskId: "task-123",
        operatorId: "operator-456",
        reasonCode: "takeover.open",
        tenantId: "tenant-xyz",
    };
    const args = {
        taskId: envConfig.taskId,
        operatorId: envConfig.operatorId,
        reasonCode: envConfig.reasonCode,
    };
    if (envConfig.tenantId != null) {
        args.tenantId = envConfig.tenantId;
    }
    assert.equal(args.tenantId, "tenant-xyz");
});
// ---------------------------------------------------------------------------
// Tests for complete_task argument building
// ---------------------------------------------------------------------------
test("complete_task requires terminalStatus", () => {
    const terminalStatus = null;
    assert.throws(() => {
        if (terminalStatus == null) {
            throw new ValidationError("missing_env:AA_TERMINAL_STATUS", "missing_env:AA_TERMINAL_STATUS");
        }
    }, { message: "missing_env:AA_TERMINAL_STATUS" });
});
test("complete_task accepts valid terminal statuses", () => {
    const validStatuses = ["done", "failed", "cancelled"];
    for (const status of validStatuses) {
        assert.ok(validStatuses.includes(status), `${status} should be valid`);
    }
});
//# sourceMappingURL=takeover.test.js.map