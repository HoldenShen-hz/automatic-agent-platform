import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getRegisteredConsumers } from "../../../src/platform/five-plane-state-evidence/events/event-registry.js";
import { mapHarnessLearnerToOapeflir, mapHarnessStepToOapeflirPhase } from "../../../src/platform/five-plane-orchestration/harness/oapeflir-harness-mapping.js";
import { OAPEFLIR_STAGES, StageTransitionFSM } from "../../../src/platform/five-plane-orchestration/oapeflir/stage-transition-fsm.js";

test("R24-30/R24-34/R31-01..R31-25: source fixes stay wired", () => {
  const runtimeTruthSource = readFileSync("src/platform/five-plane-state-evidence/truth/runtime-truth-repository.ts", "utf8");
  const taskRepoSource = readFileSync("src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.ts", "utf8");
  const workflowRepoSource = readFileSync("src/platform/five-plane-state-evidence/truth/sqlite/repositories/workflow-repository.ts", "utf8");
  const executionRepoSource = readFileSync("src/platform/five-plane-state-evidence/truth/sqlite/repositories/execution-repository.ts", "utf8");
  const sessionRepoSource = readFileSync("src/platform/five-plane-state-evidence/truth/sqlite/repositories/session-repository.ts", "utf8");
  const approvalRepoSource = readFileSync("src/platform/five-plane-state-evidence/truth/sqlite/repositories/approval-repository.ts", "utf8");
  const workerSnapshotRepoSource = readFileSync("src/platform/five-plane-state-evidence/truth/sqlite/repositories/worker-snapshot-repository.ts", "utf8");
  const loopServiceSource = [
    readFileSync("src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.ts", "utf8"),
    readFileSync("src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-core.ts", "utf8"),
  ].join("\n");
  const mappingSource = readFileSync("src/platform/five-plane-orchestration/harness/oapeflir-harness-mapping.ts", "utf8");
  const fsmSource = readFileSync("src/platform/five-plane-orchestration/oapeflir/stage-transition-fsm.ts", "utf8");
  const timelineSource = readFileSync("src/platform/five-plane-orchestration/oapeflir/stage-timeline.ts", "utf8");
  const finalResponseSource = readFileSync("src/platform/five-plane-orchestration/oapeflir/final-response.ts", "utf8");
  const assessmentSource = readFileSync("src/platform/five-plane-orchestration/oapeflir/assessment-service.ts", "utf8");
  const agentTeamSource = readFileSync("src/platform/five-plane-orchestration/routing/agent-team-service.ts", "utf8");
  const intakeRouterSource = readFileSync("src/platform/five-plane-orchestration/routing/intake-router.ts", "utf8");
  const eventRegistrySource = readFileSync("src/platform/five-plane-state-evidence/events/event-registry.ts", "utf8");
  const durableBusSource = readFileSync("src/platform/five-plane-state-evidence/events/durable-event-bus.ts", "utf8");
  const organizationRepoSource = readFileSync("src/platform/five-plane-state-evidence/truth/sqlite/repositories/organization-repository.ts", "utf8");

  assert.match(runtimeTruthSource, /public upsertWithCas/);
  assert.match(runtimeTruthSource, /public replayEvents\(events: readonly PlatformFactEvent\[\]\): void/);
  assert.match(runtimeTruthSource, /const event = this\.appendEvent\(result\.event\)/);
  assert.match(taskRepoSource, /public updateTaskStatusCas/);
  assert.match(taskRepoSource, /public updateTaskOutputCas/);
  assert.match(taskRepoSource, /public updateTaskTitleCas/);
  assert.match(workflowRepoSource, /public updateWorkflowStateCas/);
  assert.match(executionRepoSource, /public updateExecutionStatusCas/);
  assert.match(sessionRepoSource, /public updateSessionStatusCas/);
  assert.match(approvalRepoSource, /public updateApprovalDecisionCas/);
  assert.match(workerSnapshotRepoSource, /worker_snapshot\.version_conflict/);

  assert.match(loopServiceSource, /const fsm = createStageTransitionFSM\(\)/);
  assert.match(loopServiceSource, /await this\.reserveBudgetForExecution\(executionContext, input\.taskId\)/);
  assert.match(loopServiceSource, /this\.eventPublisher = options\.eventPublisher \?\? undefined/);
  assert.match(loopServiceSource, /loopPlanGraphBundle = await this\.runStage<PlanGraphBundle>\("plan"/);
  assert.match(loopServiceSource, /const validatedAssessment: UnifiedAssessment =/);
  assert.match(loopServiceSource, /const validation = validateStepOutputs\(input\.stepOutputs\)/);
  assert.match(loopServiceSource, /fsm\.recordStageSkipped\("release", "release\.approval_required"\)/);

  assert.match(mappingSource, /if \(stage === "learn" \|\| role === "learner"\)/);
  assert.match(mappingSource, /if \(stage === "release" \|\| role === "release_manager"\)/);
  assert.match(mappingSource, /if \(role === "hitl_operator"\)/);
  assert.match(mappingSource, /return "observe"/);

  assert.doesNotMatch(fsmSource, /"knowledge_promotion"/);
  assert.doesNotMatch(timelineSource, /"knowledge_promotion"/);
  assert.match(fsmSource, /public getCurrentStage\(\): OapeflirStage \{\s+if \(this\.currentStageIndex >= STAGE_ORDER\.length\) \{\s+return STAGE_ORDER\[STAGE_ORDER\.length - 1\]!;/s);
  assert.match(fsmSource, /private readonly skippedReasonCodes = new Map<OapeflirStage, string>\(\)/);
  assert.match(fsmSource, /this\.skippedReasonCodes\.set\(stage, reasonCode\)/);

  assert.match(finalResponseSource, /audience: string;/);
  assert.match(finalResponseSource, /limitations: string;/);
  assert.match(finalResponseSource, /dataClass: string;/);
  assert.match(finalResponseSource, /redactionApplied: boolean;/);
  assert.match(finalResponseSource, /safetyLabels: readonly string\[\];/);

  assert.match(assessmentSource, /estimateWorstPathCost/);
  assert.match(assessmentSource, /budget_exceeds_feasibility_threshold/);
  assert.match(assessmentSource, /steps_exceed_feasibility_threshold/);
  assert.match(assessmentSource, /duration_exceeds_feasibility_threshold/);

  assert.match(agentTeamSource, /AGENT_TEAM_STAGE_TO_OAPEFLIR_PHASE/);
  assert.match(agentTeamSource, /release: "release"/);
  assert.match(intakeRouterSource, /Budget entry is handled by the budget allocation layer, not by intake router\./);

  assert.match(eventRegistrySource, /R31-17 FIX: Now also returns consumers for RUNTIME_EVENT_REPLAY_METADATA events\./);
  assert.match(durableBusSource, /for \(let attempt = 0; attempt < MAX_DELIVERY_RETRIES; attempt\+\+\)/);
  assert.match(durableBusSource, /const processedConsumerIds = new Set<string>\(\)/);
  assert.match(durableBusSource, /return 0;\s+\}/);
  assert.ok(!organizationRepoSource.includes(" IS $"));
});

test("R31-03/R31-14/R31-17: harness mapping and replay consumer registration stay aligned", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("learner", "learn"), "learn");
  assert.equal(mapHarnessLearnerToOapeflir("release_manager"), "release");
  assert.equal(mapHarnessStepToOapeflirPhase("hitl_operator", "approve"), "assess");
  assert.deepEqual(getRegisteredConsumers("platform.harness_run.status_changed"), ["truth_projector", "audit_projection"]);
  assert.deepEqual(getRegisteredConsumers("oapeflir.view.run_lifecycle"), ["oapeflir_projection", "inspect_projection"]);
});

test("R31-07/R31-11: stage transition FSM preserves skip reasons and never returns undefined after completion", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("observe");
  for (const stage of OAPEFLIR_STAGES) {
    fsm.recordStageCompletion(stage);
  }

  assert.equal(fsm.isComplete(), true);
  assert.equal(fsm.getCurrentStage(), "release");

  const skipped = new StageTransitionFSM();
  skipped.recordStageSkipped("release", "release.approval_required");
  assert.equal(skipped.getStageSkipReason("release"), "release.approval_required");
});
