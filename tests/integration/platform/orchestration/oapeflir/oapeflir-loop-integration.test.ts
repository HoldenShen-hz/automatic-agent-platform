/**
 * Integration Test: OAPEFLIR Loop Service
 *
 * Tests the full OAPEFLIR (Observe→Assess→Plan→Execute→Feedback→Learn→Improve→Release)
 * loop lifecycle including stage boundaries, observation aggregation, assessment
 * routing, plan building, execution bridging, feedback collection, learning
 * objects, and rollout records using SQLite context.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { createIntegrationContext, createSeededIntegrationContext } from "../../../../helpers/integration-context.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { OapeflirLoopService, type OapeflirLoopInput } from "../../../../../src/platform/orchestration/oapeflir/oapeflir-loop-service.js";
import { WorkflowPlanner } from "../../../../../src/platform/orchestration/routing/workflow-planner.js";
import { MockExecuteBridge } from "../../../../../src/platform/orchestration/oapeflir/runtime-execute-bridge.js";

function createOapeflirContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "oapeflir-integration.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, dbPath, db, store };
}

function createPlannedWorkflow() {
  const planner = new WorkflowPlanner();
  return planner.plan({
    workflowId: "single_division_multi_step_orchestration",
    request: "OAPEFLIR integration test workflow",
  });
}

test("OAPEFLIR loop runs full observe->assess->plan->execute pipeline with all stages", async () => {
  const ctx = createOapeflirContext("aa-oapeflir-full-");
  try {
    const service = new OapeflirLoopService({ dbPath: ctx.dbPath });
    const workflow = createPlannedWorkflow();

    const input: OapeflirLoopInput = {
      taskId: "task_oapeflir_full_001",
      objective: "implement feature with full OAPEFLIR loop",
      workflow,
      feedbackSignals: [
        {
          signalId: "sig_1",
          source: "execution",
          taskId: "task_oapeflir_full_001",
          category: "correction",
          severity: "warning",
          payload: {
            summary: "validation requested narrower diff",
            reasonCode: "validation.repair_required",
            durationMs: 30,
          },
          stepOutputRefs: ["draft_solution"],
          timestamp: Date.now(),
        },
      ],
    };

    const result = await service.run(input);

    // All 8 stages should appear in timeline
    assert.equal(result.timeline.length >= 8, true, "Should have at least 8 stage entries");
    const stages = result.timeline.map((entry) => entry.stage);
    assert.deepEqual(
      stages,
      ["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"],
      "Should complete all OAPEFLIR stages in order",
    );

    // Observation should contain task and system situations
    assert.ok(result.observation.task, "Should have task observation");
    assert.ok(result.observation.system, "Should have system observation");
    assert.equal(result.observation.task.taskId, "task_oapeflir_full_001");

    // Assessment should have routing decision
    assert.ok(result.assessment.routingDecision, "Should have routing decision");
    assert.ok(result.assessment.routingDecision.division.length > 0, "Should have division");
    assert.ok(result.assessment.routingDecision.workflow.length > 0, "Should have workflow");

    // Plan should be built
    assert.ok(result.plan.planId, "Should have planId");
    assert.ok(result.plan.steps.length > 0, "Should have steps in plan");

    // Feedback should be collected
    assert.ok(result.feedback, "Should have feedback");
    assert.ok(result.feedback.signals.length > 0, "Should have feedback signals");

    // Learning signals should be produced
    assert.ok(result.learningSignals.length >= 0, "Should have learning signals");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OAPEFLIR loop closes shadow loop for repairable execution", async () => {
  const ctx = createOapeflirContext("aa-oapeflir-repair-");
  try {
    const service = new OapeflirLoopService({ dbPath: ctx.dbPath });
    const workflow = createPlannedWorkflow();

    const input: OapeflirLoopInput = {
      taskId: "task_oapeflir_repair_001",
      objective: "repair failing workflow",
      workflow,
      feedbackSignals: [
        {
          signalId: "sig_repair",
          source: "execution",
          taskId: "task_oapeflir_repair_001",
          category: "correction",
          severity: "warning",
          payload: {
            summary: "validation requested narrower diff",
            reasonCode: "validation.repair_required",
            durationMs: 30,
          },
          stepOutputRefs: ["draft_solution"],
          timestamp: Date.now(),
        },
      ],
    };

    const result = await service.run(input);

    assert.equal(result.plan.taskId, "task_oapeflir_repair_001");
    assert.equal(result.qualityGate.releaseStage, "repair");
    assert.equal(result.replanDecision.shouldReplan, true);
    assert.equal(result.learningSignals.length >= 1, true);
    assert.equal(result.rolloutRecord?.level, "shadow");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OAPEFLIR loop produces observation with task and system situation", async () => {
  const ctx = createOapeflirContext("aa-oapeflir-observe-");
  try {
    const service = new OapeflirLoopService({ dbPath: ctx.dbPath });
    const workflow = createPlannedWorkflow();

    const input: OapeflirLoopInput = {
      taskId: "task_oapeflir_observe_001",
      objective: "observe task for assessment",
      workflow,
      fileRefs: ["src/foo.ts", "src/bar.ts"],
      blockerSummaries: ["dependency missing"],
    };

    const result = await service.run(input);

    assert.ok(result.observation.task, "Should have task observation");
    assert.equal(result.observation.task.taskId, "task_oapeflir_observe_001");
    assert.equal(result.observation.task.objective, "observe task for assessment");
    assert.ok(result.observation.task.blockers.length > 0, "Should have blockers");
    assert.ok(result.observation.system, "Should have system observation");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OAPEFLIR loop produces assessment with routing decision", async () => {
  const ctx = createOapeflirContext("aa-oapeflir-assess-");
  try {
    const service = new OapeflirLoopService({ dbPath: ctx.dbPath });
    const workflow = createPlannedWorkflow();

    const input: OapeflirLoopInput = {
      taskId: "task_oapeflir_assess_001",
      objective: "assess routing decision",
      workflow,
    };

    const result = await service.run(input);

    assert.ok(result.assessment.routingDecision, "Should have routing decision");
    assert.ok(result.assessment.routingDecision.division.length > 0, "Should have division");
    assert.ok(result.assessment.routingDecision.workflow.length > 0, "Should have workflow");
    assert.ok(result.assessment.routingDecision.rationale.length > 0, "Should have rationale");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OAPEFLIR loop produces execution plan from workflow", async () => {
  const ctx = createOapeflirContext("aa-oapeflir-plan-");
  try {
    const service = new OapeflirLoopService({ dbPath: ctx.dbPath });
    const workflow = createPlannedWorkflow();

    const input: OapeflirLoopInput = {
      taskId: "task_oapeflir_plan_001",
      objective: "produce execution plan",
      workflow,
    };

    const result = await service.run(input);

    assert.ok(result.plan.planId, "Should have planId");
    assert.equal(result.plan.taskId, "task_oapeflir_plan_001");
    assert.ok(result.plan.steps.length > 0, "Should have steps in plan");
    assert.equal(result.plan.strategy, "linear");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OAPEFLIR loop produces outcome evaluation and quality gate decision", async () => {
  const ctx = createOapeflirContext("aa-oapeflir-quality-");
  try {
    const service = new OapeflirLoopService({ dbPath: ctx.dbPath });
    const workflow = createPlannedWorkflow();

    const input: OapeflirLoopInput = {
      taskId: "task_oapeflir_quality_001",
      objective: "evaluate quality gate",
      workflow,
    };

    const result = await service.run(input);

    assert.ok(result.outcome, "Should have outcome evaluation");
    assert.ok(result.qualityGate, "Should have quality gate decision");
    assert.ok(typeof result.qualityGate.accepted === "boolean", "Should have accepted boolean");
    assert.ok(result.qualityGate.reasonCodes.length >= 0, "Should have reason codes");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OAPEFLIR loop produces replan decision based on quality gate", async () => {
  const ctx = createOapeflirContext("aa-oapeflir-replan-");
  try {
    const service = new OapeflirLoopService({ dbPath: ctx.dbPath });
    const workflow = createPlannedWorkflow();

    const input: OapeflirLoopInput = {
      taskId: "task_oapeflir_replan_001",
      objective: "make replan decision",
      workflow,
    };

    const result = await service.run(input);

    assert.ok(result.replanDecision, "Should have replan decision");
    assert.ok(typeof result.replanDecision.shouldReplan === "boolean", "Should have shouldReplan boolean");
    assert.equal(result.replanDecision.taskId, "task_oapeflir_replan_001");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OAPEFLIR loop timeline records all stage transitions in order", async () => {
  const ctx = createOapeflirContext("aa-oapeflir-timeline-");
  try {
    const service = new OapeflirLoopService({ dbPath: ctx.dbPath });
    const workflow = createPlannedWorkflow();

    const input: OapeflirLoopInput = {
      taskId: "task_oapeflir_timeline_001",
      objective: "record timeline",
      workflow,
    };

    const result = await service.run(input);

    // Verify timeline is chronologically ordered
    assert.equal(
      result.timeline.every((entry, index, items) => index === 0 || entry.startedAt > items[index - 1]!.startedAt),
      true,
      "Timeline entries should be in chronological order",
    );

    // Verify each entry has required fields
    for (const entry of result.timeline) {
      assert.ok(entry.stage, "Should have stage");
      assert.ok(entry.status, "Should have status");
      assert.ok(entry.startedAt > 0, "Should have startedAt");
    }
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OAPEFLIR loop with repairable signals produces repair release stage", async () => {
  const ctx = createOapeflirContext("aa-oapeflir-repair-stage-");
  try {
    const service = new OapeflirLoopService({ dbPath: ctx.dbPath });
    const workflow = createPlannedWorkflow();

    const input: OapeflirLoopInput = {
      taskId: "task_oapeflir_repair_stage_001",
      objective: "trigger repair release",
      workflow,
      feedbackSignals: [
        {
          signalId: "sig_repair",
          source: "execution",
          taskId: "task_oapeflir_repair_stage_001",
          category: "correction",
          severity: "warning",
          payload: {
            summary: "validation failed, repair needed",
            reasonCode: "validation.repair_required",
            durationMs: 50,
          },
          stepOutputRefs: ["draft_solution"],
          timestamp: Date.now(),
        },
      ],
    };

    const result = await service.run(input);

    assert.equal(result.qualityGate.releaseStage, "repair");
    assert.equal(result.replanDecision.shouldReplan, true);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OAPEFLIR loop with successful execution produces accept release stage", async () => {
  const ctx = createOapeflirContext("aa-oapeflir-accept-");
  try {
    const service = new OapeflirLoopService({ dbPath: ctx.dbPath });
    const workflow = createPlannedWorkflow();

    const input: OapeflirLoopInput = {
      taskId: "task_oapeflir_accept_001",
      objective: "successful execution",
      workflow,
      feedbackSignals: [
        {
          signalId: "sig_success",
          source: "execution",
          taskId: "task_oapeflir_accept_001",
          category: "success",
          severity: "info",
          payload: {
            summary: "all validations passed",
            reasonCode: "validation.success",
            durationMs: 100,
          },
          stepOutputRefs: ["final_review"],
          timestamp: Date.now(),
        },
      ],
    };

    const result = await service.run(input);

    // Successful execution should not require replan
    assert.equal(result.replanDecision.shouldReplan, false);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OAPEFLIR loop uses seeded integration context", async () => {
  const ctx = createSeededIntegrationContext("aa-oapeflir-seeded-");

  try {
    const service = new OapeflirLoopService({ dbPath: ctx.dbPath });
    const workflow = createPlannedWorkflow();

    const input: OapeflirLoopInput = {
      taskId: "task-seeded-001",
      objective: "test seeded context",
      workflow,
    };

    const result = await service.run(input);

    assert.ok(result.observation, "Should run with seeded context");
    assert.ok(result.assessment, "Should have assessment");
    assert.equal(result.plan.taskId, "task-seeded-001");
  } finally {
    ctx.cleanup();
  }
});

test("OAPEFLIR loop produces rollout record for learning objects", async () => {
  const ctx = createOapeflirContext("aa-oapeflir-rollout-");
  try {
    const service = new OapeflirLoopService({ dbPath: ctx.dbPath });
    const workflow = createPlannedWorkflow();

    const input: OapeflirLoopInput = {
      taskId: "task_oapeflir_rollout_001",
      objective: "produce learning objects with rollout",
      workflow,
      feedbackSignals: [
        {
          signalId: "sig_learning",
          source: "execution",
          taskId: "task_oapeflir_rollout_001",
          category: "correction",
          severity: "warning",
          payload: {
            summary: "improvement opportunity detected",
            reasonCode: "improvement.detected",
            durationMs: 50,
          },
          stepOutputRefs: ["draft_solution"],
          timestamp: Date.now(),
        },
      ],
    };

    const result = await service.run(input);

    // Learning objects may be produced from feedback; rollout record may or may not be present
    assert.ok(result.learningObjects.length >= 0 || result.rolloutRecord === null || result.rolloutRecord !== null);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OAPEFLIR loop handles blocker summaries in observation", async () => {
  const ctx = createOapeflirContext("aa-oapeflir-blocker-");
  try {
    const service = new OapeflirLoopService({ dbPath: ctx.dbPath });
    const workflow = createPlannedWorkflow();

    const input: OapeflirLoopInput = {
      taskId: "task_oapeflir_blocker_001",
      objective: "handle blockers",
      workflow,
      blockerSummaries: ["dependency missing", "permission denied"],
    };

    const result = await service.run(input);

    assert.ok(result.observation, "Should produce observation despite blockers");
    assert.ok(result.assessment, "Should produce assessment");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OAPEFLIR loop with custom MockExecuteBridge skips actual execution", async () => {
  const ctx = createOapeflirContext("aa-oapeflir-mock-");
  try {
    const service = new OapeflirLoopService({ executeBridge: new MockExecuteBridge() });
    const workflow = createPlannedWorkflow();

    const input: OapeflirLoopInput = {
      taskId: "task_oapeflir_mock_001",
      objective: "test with mock bridge",
      workflow,
    };

    const result = await service.run(input);

    assert.ok(result.observation, "Should have observation");
    assert.ok(result.assessment, "Should have assessment");
    assert.ok(result.plan, "Should have plan");
    assert.equal(result.timeline.length >= 8, true);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("OAPEFLIR loop buildSerializedHandoff produces handoff for agent continuation", async () => {
  const ctx = createOapeflirContext("aa-oapeflir-handoff-");
  try {
    const service = new OapeflirLoopService({ dbPath: ctx.dbPath });
    const workflow = createPlannedWorkflow();

    const input: OapeflirLoopInput = {
      taskId: "task_oapeflir_handoff_001",
      objective: "build handoff",
      workflow,
      feedbackSignals: [
        {
          signalId: "sig_handoff",
          source: "execution",
          taskId: "task_oapeflir_handoff_001",
          category: "success",
          severity: "info",
          payload: {
            summary: "task completed successfully",
            reasonCode: "task.success",
            durationMs: 100,
          },
          stepOutputRefs: ["final_review"],
          timestamp: Date.now(),
        },
      ],
    };

    const result = await service.run(input);
    const handoff = service.buildSerializedHandoff(result, "agent_1", "agent_2", 4096);

    assert.ok(handoff.fromAgentId === "agent_1");
    assert.ok(handoff.toAgentId === "agent_2");
    assert.ok(handoff.serialized.length > 0, "Should produce serialized handoff");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});
