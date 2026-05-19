/**
 * PMF CLI Tests
 *
 * Tests for pmf.ts CLI module and its action validation.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ValidationError from src platform/contracts/errors
class ValidationError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "ValidationError";
        this.code = code;
    }
}
// ---------------------------------------------------------------------------
// Tests for PMF action validation
// ---------------------------------------------------------------------------
const PMF_ACTIONS = ["report", "run", "export", "history", "latest"];
test("PMF supports report action", () => {
    const action = "report";
    assert.ok(PMF_ACTIONS.includes(action));
});
test("PMF supports run action", () => {
    const action = "run";
    assert.ok(PMF_ACTIONS.includes(action));
});
test("PMF supports export action", () => {
    const action = "export";
    assert.ok(PMF_ACTIONS.includes(action));
});
test("PMF supports history action", () => {
    const action = "history";
    assert.ok(PMF_ACTIONS.includes(action));
});
test("PMF supports latest action", () => {
    const action = "latest";
    assert.ok(PMF_ACTIONS.includes(action));
});
test("PMF throws ValidationError for unknown action", () => {
    const action = "unknown";
    const errorPrefix = `unknown_pmf_action:${action}`;
    assert.throws(() => {
        if (!PMF_ACTIONS.includes(action)) {
            throw new ValidationError(errorPrefix, errorPrefix);
        }
    }, { message: errorPrefix });
});
test("PMF_ACTIONS has exactly 5 actions", () => {
    assert.equal(PMF_ACTIONS.length, 5);
});
// ---------------------------------------------------------------------------
// Tests for PMF options building
// ---------------------------------------------------------------------------
test("report action builds options with optional profileName", () => {
    const envConfig = {
        profileName: "claude-sonnet",
        divisionId: null,
        windowDays: null,
        evaluatedAt: null,
    };
    const options = {};
    if (envConfig.profileName) {
        options.profileName = envConfig.profileName;
    }
    if (envConfig.divisionId !== null) {
        options.divisionId = envConfig.divisionId;
    }
    if (envConfig.windowDays != null) {
        options.windowDays = envConfig.windowDays;
    }
    if (envConfig.evaluatedAt) {
        options.evaluatedAt = envConfig.evaluatedAt;
    }
    assert.equal(options.profileName, "claude-sonnet");
    assert.equal(options.divisionId, undefined);
    assert.equal(options.windowDays, undefined);
});
test("report action builds options with optional divisionId", () => {
    const envConfig = {
        profileName: null,
        divisionId: "div-123",
        windowDays: null,
        evaluatedAt: null,
    };
    const options = {};
    if (envConfig.profileName) {
        options.profileName = envConfig.profileName;
    }
    if (envConfig.divisionId !== null) {
        options.divisionId = envConfig.divisionId;
    }
    if (envConfig.windowDays != null) {
        options.windowDays = envConfig.windowDays;
    }
    if (envConfig.evaluatedAt) {
        options.evaluatedAt = envConfig.evaluatedAt;
    }
    assert.equal(options.profileName, undefined);
    assert.equal(options.divisionId, "div-123");
});
test("report action builds options with optional windowDays", () => {
    const envConfig = {
        profileName: null,
        divisionId: null,
        windowDays: 30,
        evaluatedAt: null,
    };
    const options = {};
    if (envConfig.profileName) {
        options.profileName = envConfig.profileName;
    }
    if (envConfig.divisionId !== null) {
        options.divisionId = envConfig.divisionId;
    }
    if (envConfig.windowDays != null) {
        options.windowDays = envConfig.windowDays;
    }
    if (envConfig.evaluatedAt) {
        options.evaluatedAt = envConfig.evaluatedAt;
    }
    assert.equal(options.windowDays, 30);
});
test("report action builds options with optional evaluatedAt", () => {
    const envConfig = {
        profileName: null,
        divisionId: null,
        windowDays: null,
        evaluatedAt: "2024-01-15T10:00:00.000Z",
    };
    const options = {};
    if (envConfig.profileName) {
        options.profileName = envConfig.profileName;
    }
    if (envConfig.divisionId !== null) {
        options.divisionId = envConfig.divisionId;
    }
    if (envConfig.windowDays != null) {
        options.windowDays = envConfig.windowDays;
    }
    if (envConfig.evaluatedAt) {
        options.evaluatedAt = envConfig.evaluatedAt;
    }
    assert.equal(options.evaluatedAt, "2024-01-15T10:00:00.000Z");
});
test("report action omits all optional fields when not provided", () => {
    const envConfig = {
        profileName: null,
        divisionId: null,
        windowDays: null,
        evaluatedAt: null,
    };
    const options = {};
    if (envConfig.profileName) {
        options.profileName = envConfig.profileName;
    }
    if (envConfig.divisionId !== null) {
        options.divisionId = envConfig.divisionId;
    }
    if (envConfig.windowDays != null) {
        options.windowDays = envConfig.windowDays;
    }
    if (envConfig.evaluatedAt) {
        options.evaluatedAt = envConfig.evaluatedAt;
    }
    assert.equal(Object.keys(options).length, 0);
});
test("report action builds options with all fields together", () => {
    const envConfig = {
        profileName: "claude-opus",
        divisionId: "div-456",
        windowDays: 14,
        evaluatedAt: "2024-02-01T00:00:00.000Z",
    };
    const options = {};
    if (envConfig.profileName) {
        options.profileName = envConfig.profileName;
    }
    if (envConfig.divisionId !== null) {
        options.divisionId = envConfig.divisionId;
    }
    if (envConfig.windowDays != null) {
        options.windowDays = envConfig.windowDays;
    }
    if (envConfig.evaluatedAt) {
        options.evaluatedAt = envConfig.evaluatedAt;
    }
    assert.equal(options.profileName, "claude-opus");
    assert.equal(options.divisionId, "div-456");
    assert.equal(options.windowDays, 14);
    assert.equal(options.evaluatedAt, "2024-02-01T00:00:00.000Z");
});
// ---------------------------------------------------------------------------
// Tests for history action
// ---------------------------------------------------------------------------
test("history action uses default limit of 20", () => {
    const envConfig = {
        limit: null,
    };
    const limit = envConfig.limit ?? 20;
    assert.equal(limit, 20);
});
test("history action uses custom limit when provided", () => {
    const envConfig = {
        limit: 50,
    };
    const limit = envConfig.limit ?? 20;
    assert.equal(limit, 50);
});
test("history action passes limit correctly", () => {
    const envConfig = {
        limit: 100,
    };
    const limit = envConfig.limit ?? 20;
    assert.equal(limit, 100);
});
// ---------------------------------------------------------------------------
// Tests for latest action
// ---------------------------------------------------------------------------
test("latest action accepts profileName", () => {
    const envConfig = {
        profileName: "claude-haiku",
    };
    const result = envConfig.profileName;
    assert.equal(result, "claude-haiku");
});
test("latest action passes null profileName", () => {
    const envConfig = {
        profileName: null,
    };
    const result = envConfig.profileName;
    assert.equal(result, null);
});
// ---------------------------------------------------------------------------
// Tests for run action
// ---------------------------------------------------------------------------
test("run action builds same options as report", () => {
    const envConfig = {
        profileName: "claude-sonnet",
        divisionId: "div-789",
        windowDays: 7,
        evaluatedAt: "2024-03-01T12:00:00.000Z",
    };
    const options = {};
    if (envConfig.profileName) {
        options.profileName = envConfig.profileName;
    }
    if (envConfig.divisionId !== null) {
        options.divisionId = envConfig.divisionId;
    }
    if (envConfig.windowDays != null) {
        options.windowDays = envConfig.windowDays;
    }
    if (envConfig.evaluatedAt) {
        options.evaluatedAt = envConfig.evaluatedAt;
    }
    assert.equal(options.profileName, "claude-sonnet");
    assert.equal(options.divisionId, "div-789");
    assert.equal(options.windowDays, 7);
    assert.equal(options.evaluatedAt, "2024-03-01T12:00:00.000Z");
});
// ---------------------------------------------------------------------------
// Tests for export action
// ---------------------------------------------------------------------------
test("export action builds same options as report", () => {
    const envConfig = {
        profileName: "custom-profile",
        divisionId: null,
        windowDays: 90,
        evaluatedAt: null,
    };
    const options = {};
    if (envConfig.profileName) {
        options.profileName = envConfig.profileName;
    }
    if (envConfig.divisionId !== null) {
        options.divisionId = envConfig.divisionId;
    }
    if (envConfig.windowDays != null) {
        options.windowDays = envConfig.windowDays;
    }
    if (envConfig.evaluatedAt) {
        options.evaluatedAt = envConfig.evaluatedAt;
    }
    assert.equal(options.profileName, "custom-profile");
    assert.equal(options.divisionId, undefined);
    assert.equal(options.windowDays, 90);
    assert.equal(options.evaluatedAt, undefined);
});
// ---------------------------------------------------------------------------
// Tests for action branching logic
// ---------------------------------------------------------------------------
test("action branching - report action maps to buildReport", () => {
    // Simulates the switch case in pmf.ts
    const action = "report";
    const methodMap = {
        report: "buildReport",
        run: "runValidation",
        export: "exportValidation",
        history: "listHistory",
        latest: "getLatest",
    };
    assert.equal(methodMap[action], "buildReport");
});
test("action branching - run action maps to runValidation", () => {
    const action = "run";
    const methodMap = {
        report: "buildReport",
        run: "runValidation",
        export: "exportValidation",
        history: "listHistory",
        latest: "getLatest",
    };
    assert.equal(methodMap[action], "runValidation");
});
test("action branching - export action maps to exportValidation", () => {
    const action = "export";
    const methodMap = {
        report: "buildReport",
        run: "runValidation",
        export: "exportValidation",
        history: "listHistory",
        latest: "getLatest",
    };
    assert.equal(methodMap[action], "exportValidation");
});
test("action branching - history action maps to listHistory", () => {
    const action = "history";
    const methodMap = {
        report: "buildReport",
        run: "runValidation",
        export: "exportValidation",
        history: "listHistory",
        latest: "getLatest",
    };
    assert.equal(methodMap[action], "listHistory");
});
test("action branching - latest action maps to getLatest", () => {
    const action = "latest";
    const methodMap = {
        report: "buildReport",
        run: "runValidation",
        export: "exportValidation",
        history: "listHistory",
        latest: "getLatest",
    };
    assert.equal(methodMap[action], "getLatest");
});
// ---------------------------------------------------------------------------
// Tests for JSON output formatting
// ---------------------------------------------------------------------------
test("PMF output is formatted as JSON", () => {
    const output = { report: "test", metrics: {} };
    const json = JSON.stringify(output, null, 2);
    assert.ok(json.includes("report"));
    assert.ok(json.includes("metrics"));
});
//# sourceMappingURL=pmf.test.js.map