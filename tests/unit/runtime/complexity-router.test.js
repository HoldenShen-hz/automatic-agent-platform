import assert from "node:assert/strict";
import test from "node:test";
import { routeComplexity } from "../../../src/platform/execution/execution-engine/complexity-router.js";
test("routeComplexity returns correct structure", () => {
    const result = routeComplexity("simple task");
    assert.equal(typeof result.path, "string");
    assert.equal(typeof result.reason, "string");
    assert.equal(typeof result.estimatedBudgetFactor, "number");
    assert.equal(typeof result.routedAt, "string");
});
test("routeComplexity routes short input to passthrough", () => {
    const result = routeComplexity("hi");
    assert.equal(result.path, "passthrough");
    assert.equal(result.reason, "short_input");
    assert.equal(result.estimatedBudgetFactor, 0.1);
});
test("routeComplexity routes very short input to passthrough", () => {
    const result = routeComplexity("a");
    assert.equal(result.path, "passthrough");
});
test("routeComplexity routes to fast with fast keywords", () => {
    // Input must be longer than passthroughMaxChars (50) to reach fast keyword check
    const result = routeComplexity("please tell me what is the weather forecast for tomorrow");
    assert.equal(result.path, "fast");
    assert.ok(result.reason.startsWith("keyword_match:"));
});
test("routeComplexity routes to full with full keywords", () => {
    // Input must be longer than passthroughMaxChars (50) to reach full keyword check
    const result = routeComplexity("refactor the entire codebase and improve the architecture");
    assert.equal(result.path, "full");
    assert.ok(result.reason.startsWith("keyword_match:"));
});
test("routeComplexity is case insensitive", () => {
    const lower = routeComplexity("what is this");
    const upper = routeComplexity("WHAT IS THIS");
    const mixed = routeComplexity("What Is This");
    assert.equal(lower.path, upper.path);
    assert.equal(upper.path, mixed.path);
});
test("routeComplexity qaMode forces full path", () => {
    const result = routeComplexity("simple task", { qaMode: true });
    assert.equal(result.path, "full");
    assert.equal(result.reason, "qa_mode_active");
    assert.equal(result.estimatedBudgetFactor, 2.0);
});
test("routeComplexity multi-step (stepCount > 3) routes to standard or full", () => {
    const result = routeComplexity("some task", { stepCount: 5 });
    assert.ok(result.path === "standard" || result.path === "full");
    assert.equal(result.reason, "multi_step_workflow");
});
test("routeComplexity multi-step with full keyword routes to full", () => {
    const result = routeComplexity("refactor this task", { stepCount: 5 });
    assert.equal(result.path, "full");
    assert.ok(result.reason.startsWith("keyword_match:"));
});
test("routeComplexity high token estimate routes to full", () => {
    // Input longer than passthroughMaxChars (50) to reach the high token check
    const result = routeComplexity("a moderately complex task that needs processing time", { estimatedTokens: 60000 });
    assert.equal(result.path, "full");
    assert.equal(result.reason, "high_token_estimate");
    assert.equal(result.estimatedBudgetFactor, 2.0);
});
test("routeComplexity default routes to standard", () => {
    // Input longer than passthroughMaxChars (50) and no special flags
    const result = routeComplexity("perform a moderately complex task with multiple steps");
    assert.equal(result.path, "standard");
    assert.equal(result.reason, "default");
    assert.equal(result.estimatedBudgetFactor, 1.0);
});
test("routeComplexity custom fullPathKeywords", () => {
    const result = routeComplexity("make it turbo mode for better performance", {
        config: {
            fullPathKeywords: ["turbo"],
            fastPathKeywords: [],
            passthroughMaxChars: 10,
            qaModeForceFull: false,
        },
    });
    assert.equal(result.path, "full");
});
test("routeComplexity custom fastPathKeywords", () => {
    const result = routeComplexity("make it turbo for faster processing", {
        config: {
            fullPathKeywords: [],
            fastPathKeywords: ["turbo"],
            passthroughMaxChars: 10,
            qaModeForceFull: false,
        },
    });
    assert.equal(result.path, "fast");
});
test("routeComplexity respects custom passthroughMaxChars", () => {
    const result = routeComplexity("short", {
        config: {
            fullPathKeywords: [],
            fastPathKeywords: [],
            passthroughMaxChars: 10,
            qaModeForceFull: false,
        },
    });
    assert.equal(result.path, "passthrough");
    const result2 = routeComplexity("medium length", {
        config: {
            fullPathKeywords: [],
            fastPathKeywords: [],
            passthroughMaxChars: 10,
            qaModeForceFull: false,
        },
    });
    assert.notEqual(result2.path, "passthrough");
});
test("routeComplexity qaModeForceFull can be disabled", () => {
    const result = routeComplexity("simple task", {
        qaMode: true,
        config: {
            fullPathKeywords: [],
            fastPathKeywords: [],
            passthroughMaxChars: 50,
            qaModeForceFull: false,
        },
    });
    // Without qaModeForceFull, qaMode alone doesn't force full
    assert.ok(["fast", "standard", "passthrough"].includes(result.path));
});
test("routeComplexity all default full keywords work", () => {
    const keywords = [
        "refactor", "redesign", "migrate", "architecture", "security audit",
        "performance analysis", "comprehensive", "all files", "entire codebase",
        "deep analysis", "root cause", "investigation",
    ];
    for (const keyword of keywords) {
        // Use long enough input to avoid passthrough (passthroughMaxChars is 50)
        const result = routeComplexity(`please help me with ${keyword} of this codebase project here`);
        assert.equal(result.path, "full", `Keyword "${keyword}" should route to full`);
    }
});
test("routeComplexity all default fast keywords work", () => {
    const keywords = [
        "what is", "show me", "list", "find", "grep", "search",
        "quick", "simple", "brief", "lookup", "check",
    ];
    for (const keyword of keywords) {
        // Use long enough input to avoid passthrough (passthroughMaxChars is 50)
        const result = routeComplexity(`can you ${keyword} the current status of the system for me`);
        assert.equal(result.path, "fast", `Keyword "${keyword}" should route to fast`);
    }
});
test("routeComplexity estimatedBudgetFactor is correct for each path", () => {
    const passthrough = routeComplexity("hi");
    assert.equal(passthrough.estimatedBudgetFactor, 0.1);
    // Use inputs longer than passthroughMaxChars (50) to reach each routing logic
    const fast = routeComplexity("can you tell me what is the system status right now please");
    assert.equal(fast.estimatedBudgetFactor, 0.3);
    const standard = routeComplexity("perform a moderately complex task with multiple steps here");
    assert.equal(standard.estimatedBudgetFactor, 1.0);
    const full = routeComplexity("please refactor the entire codebase and improve architecture");
    assert.equal(full.estimatedBudgetFactor, 2.0);
});
test("routeComplexity has ISO timestamp in routedAt", () => {
    const result = routeComplexity("test");
    // Should be parseable as an ISO date
    const date = new Date(result.routedAt);
    assert.ok(!isNaN(date.getTime()));
});
test("routeComplexity handles negative estimatedTokens without error", () => {
    // Negative token values should not trigger high_token_estimate path
    const result = routeComplexity("some task that is long enough to not be passthrough", { estimatedTokens: -1000 });
    // Should return a valid result, not throw - negative tokens don't trigger high_token_estimate
    assert.equal(typeof result.path, "string");
    assert.equal(typeof result.reason, "string");
    assert.equal(typeof result.estimatedBudgetFactor, "number");
});
test("routeComplexity handles zero estimatedTokens without error", () => {
    const result = routeComplexity("some task that is long enough to not be passthrough", { estimatedTokens: 0 });
    // Should return a valid result
    assert.equal(typeof result.path, "string");
    assert.equal(typeof result.reason, "string");
});
test("routeComplexity handles very large estimatedTokens", () => {
    // Very large token values should route to full
    // Need input longer than passthroughMaxChars (50) to reach the high_token_estimate check
    const result = routeComplexity("a task that is longer than fifty characters to bypass passthrough", { estimatedTokens: 1000000 });
    assert.equal(result.path, "full");
    assert.equal(result.reason, "high_token_estimate");
});
//# sourceMappingURL=complexity-router.test.js.map