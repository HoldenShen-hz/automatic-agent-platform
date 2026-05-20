import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ValidationError } from "../../../src/platform/contracts/errors.js";
import { createToolArgumentCoercionMiddleware } from "../../../src/platform/five-plane-execution/tool-executor/tool-argument-coercion.js";
import { ChargebackService } from "../../../src/platform/model-gateway/cost-tracker/chargeback-service.js";
import { BudgetGuard } from "../../../src/platform/model-gateway/cost-tracker/budget-guard.js";
import { GoalDecompositionService } from "../../../src/interaction/goal-decomposer/index.js";
import { UnifiedChatPlanGenerator } from "../../../src/interaction/goal-decomposer/llm-plan-generator.js";
import { UxEventTrackingService } from "../../../src/interaction/ux/ux-event-tracking-service.js";
import { resolveRequiredSlots } from "../../../src/interaction/nl-gateway/slot-resolver/index.js";
import { SqlExecutionMetricsProvider } from "../../../src/interaction/autonomy/historical-metrics-provider.js";
import { loadNlGatewayConfig } from "../../../src/interaction/nl-gateway/nl-gateway-config-loader.js";

test("R32-14/R32-16/R32-17/R32-18/R32-20/R32-21/R32-22/R32-23/R32-24/R32-26/R32-27/R32-29/R32-33/R32-34/R32-36/R32-37/R32-38: source fixes stay wired", () => {
  const webFetchSource = readFileSync("src/platform/five-plane-execution/tool-executor/web-fetch.ts", "utf8");
  const sanitizerSource = readFileSync("src/platform/five-plane-execution/tool-executor/tool-output-sanitizer.ts", "utf8");
  const credentialPoolSource = readFileSync("src/platform/model-gateway/provider-registry/provider-credential-pool.ts", "utf8");
  const anthropicSource = readFileSync("src/platform/model-gateway/provider-registry/anthropic/anthropic-chat-service.ts", "utf8");
  const unifiedProviderSource = readFileSync("src/platform/model-gateway/provider-registry/unified-chat-provider.ts", "utf8");
  const baseProviderSource = readFileSync("src/platform/model-gateway/provider-registry/base-chat-provider.ts", "utf8");
  const costReportSource = readFileSync("src/platform/five-plane-interface/api/cost-report-service.ts", "utf8");
  const credentialSupportSource = readFileSync("src/platform/model-gateway/provider-registry/provider-credential-pool-support.ts", "utf8");
  const openaiSource = readFileSync("src/platform/model-gateway/provider-registry/openai/openai-chat-service.ts", "utf8");
  const proactiveSource = readFileSync("src/interaction/proactive-agent/index.ts", "utf8");
  const autonomySource = readFileSync("src/interaction/autonomy/index.ts", "utf8");
  const levelManagerSource = readFileSync("src/interaction/autonomy/level-manager/index.ts", "utf8");
  const goalDecomposerSource = readFileSync("src/interaction/goal-decomposer/index.ts", "utf8");
  const ambiguityHandlerSource = readFileSync("src/interaction/nl-gateway/ambiguity-handler/index.ts", "utf8");

  assert.match(webFetchSource, /const parsedContentLength =/);
  assert.match(webFetchSource, /\^\\d\+\$/);
  assert.match(sanitizerSource, /new RegExp\(definition\.source, definition\.flags\)/);
  assert.ok(!sanitizerSource.includes("pattern.lastIndex = 0"));
  assert.match(credentialPoolSource, /signal\.statusCode === 401 \|\| signal\.statusCode === 403 \|\| signal\.statusCode === 408/);
  assert.match(anthropicSource, /Object\.assign\(accumulatedUsage, parsed\.usage\)/);
  assert.match(anthropicSource, /shouldRetryWithinPool\(response\.status, \[402, 429, 500, 502, 503, 529\]\)/);
  assert.match(unifiedProviderSource, /modelLower\.includes\(prefix\.toLowerCase\(\)\)/);
  assert.ok(!baseProviderSource.includes('...(stream && !("stream" in request) ? { stream: true } : {})'));
  assert.match(costReportSource, /const earliestPeriodStart =/);
  assert.match(credentialSupportSource, /new Date\(record\.cooldownUntil\)\.getTime\(\) > new Date\(now\)\.getTime\(\)/);
  assert.match(openaiSource, /accumulatedRefusal \+= choice\.delta\.refusal/);
  assert.match(proactiveSource, /Math\.abs\(metric\.value - metric\.previousValue\) \/ Math\.abs\(metric\.previousValue\)/);
  assert.match(proactiveSource, /triggerIds: cycleNodes/);
  assert.match(levelManagerSource, /"frozen",\s+"suggestion",\s+"supervised",\s+"semi_auto",\s+"full_auto"/);
  assert.match(autonomySource, /const order: readonly AutonomyLevel\[] = \["frozen", "suggestion", "supervised", "semi_auto", "full_auto"\]/);
  assert.match(ambiguityHandlerSource, /export \{ detectAmbiguity \} from "\.\.\/disambiguation-handler\/index\.js";/);
  assert.ok(!goalDecomposerSource.includes("const normalized = description.toLowerCase();"));
  assert.ok(!goalDecomposerSource.includes("estimatedDuration: `${Math.max(1, tasks.length)}d`"));
});

test("R32-15: tool argument coercion replaces input args without mutating the original object reference", async () => {
  const middleware = createToolArgumentCoercionMiddleware();
  const originalArgs: Record<string, unknown> = {
    question: 123,
    required: "true",
  };
  const input = {
    toolName: "question",
    args: originalArgs,
  };

  await middleware.run({} as never, input, async () => {
    assert.equal(input.args.question, "123");
    assert.equal(input.args.required, true);
    assert.equal(originalArgs.question, 123);
    assert.equal(originalArgs.required, "true");
    assert.notEqual(input.args, originalArgs);
  });
});

test("R32-19: ChargebackService preserves null tenantId instead of widening to all-tenant report scope", () => {
  const captured: Array<string | null | undefined> = [];
  const service = new ChargebackService({
    listReports(limit, tenantId) {
      captured.push(tenantId);
      assert.equal(limit, 5);
      return [];
    },
  });

  service.buildReport({ limit: 5, tenantId: null });

  assert.deepEqual(captured, [null]);
});

test("R32-25: BudgetGuard allows exact hard-limit task spend but surfaces approval warning", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: {
      maxTaskCostUsd: 1,
      maxDailyCostUsd: 10,
      maxMonthlyCostUsd: 100,
      warnAtRatio: 1,
      approvalThresholdUsd: 1,
      mode: "supervised",
    },
    currentTaskCostUsd: 0.4,
    nextEstimatedCostUsd: 0.6,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "budget.approaching_limit");
});

test("R32-28/R32-39: UnifiedChatPlanGenerator rejects invalid LLM task cost/shape before any toFixed crash", async () => {
  const generator = new UnifiedChatPlanGenerator({
    provider: {
      complete: async () => JSON.stringify({
        tasks: [
          {
            domainId: "ops",
            description: "bad plan task",
            expectedOutputs: ["report"],
            delegationMode: "auto",
            estimatedDuration: "2h",
            estimatedCostUsd: "not-a-number",
          },
        ],
        dependencyGraph: [],
      }),
    } as never,
  });

  await assert.rejects(
    () =>
      generator.generate({
        goalId: "goal-1",
        description: "prepare release readiness",
        owner: "ops",
        successCriteria: [],
        constraints: [],
        priority: "normal",
      }),
    /goal_decomposer\.invalid_llm_plan_estimated_cost:0/,
  );
});

test("R32-30: UxEventTrackingService keeps separate A/B assignments per testId for the same user", () => {
  const service = new UxEventTrackingService();

  const first = service.assignABTest("user-1", {
    testId: "landing-page",
    variants: [{ variantId: "control", weight: 50 }, { variantId: "variant-a", weight: 50 }],
    stickinessFactor: 1,
    minSampleSize: 10,
  });
  const second = service.assignABTest("user-1", {
    testId: "checkout-flow",
    variants: [{ variantId: "control", weight: 50 }, { variantId: "variant-b", weight: 50 }],
    stickinessFactor: 1,
    minSampleSize: 10,
  });

  assert.equal(service.getABTestAssignment("user-1", "landing-page")?.testId, "landing-page");
  assert.equal(service.getABTestAssignment("user-1", "checkout-flow")?.testId, "checkout-flow");
  assert.notEqual(`${first.testId}:${first.variantId}`, `${second.testId}:${second.variantId}`);
});

test("R32-31/R32-33: GoalDecompositionService uses collision-safe goal ids and aggregated task durations", async () => {
  const service = new GoalDecompositionService();
  const first = await service.decompose("1234567890abcdef launch a regional marketing campaign for product alpha");
  const second = await service.decompose("1234567890abcdef investigate an incident response process for product beta");
  const totalHours = first.tasks.reduce((sum, task) => {
    const match = /^(\d+)(h|d)$/.exec(task.estimatedDuration);
    if (!match) {
      return sum;
    }
    const value = Number(match[1]);
    return sum + (match[2] === "d" ? value * 24 : value);
  }, 0);
  const expectedDuration = `${Math.max(1, Math.ceil(totalHours / 24))}d`;

  assert.notEqual(first.goalId, second.goalId);
  assert.equal(first.estimatedDuration, expectedDuration);
});

test("R32-32: slot resolution does not treat prototype-chain names as already resolved", () => {
  const result = resolveRequiredSlots([], ["constructor", "tenantId"]);

  assert.deepEqual(result.missing, ["constructor", "tenantId"]);
  assert.equal(Object.keys(result.resolved).length, 0);
  assert.equal(Object.getPrototypeOf(result.resolved), Object.prototype);
});

test("R32-35: historical metrics count only failed executions with real error codes as incidents", async () => {
  const provider = new SqlExecutionMetricsProvider({
    connection: {
      prepare() {
        return {
          all() {
            return [
              { status: "succeeded", requires_approval: 0, last_error_code: "transient", created_at: "2026-05-11T00:00:00.000Z" },
              { status: "failed", requires_approval: 1, last_error_code: "incident.timeout", created_at: "2026-05-11T01:00:00.000Z" },
              { status: "failed", requires_approval: 0, last_error_code: null, created_at: "2026-05-11T02:00:00.000Z" },
            ];
          },
        };
      },
    },
  } as never);

  const metrics = await provider.fetchMetrics({
    agentId: "agent-1",
    capabilityId: "deploy",
    currentAutonomy: "supervised",
    windowDays: 30,
  });

  assert.equal(metrics.incidents, 1);
  assert.equal(metrics.lastIncidentAt, "2026-05-11T01:00:00.000Z");
});

test("R32-40: loadNlGatewayConfig rejects malformed schema instead of silently accepting it", () => {
  const tempDir = mkdtempSync(join("/tmp", "nl-gateway-config-"));
  const configPath = join(tempDir, "invalid.json");

  try {
    writeFileSync(configPath, JSON.stringify({
      disambiguation: {
        threshold: "0.8",
      },
    }));

    assert.throws(
      () => loadNlGatewayConfig(configPath),
      (error: unknown) => error instanceof ValidationError && error.code === "nl_gateway.invalid_config_schema",
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
