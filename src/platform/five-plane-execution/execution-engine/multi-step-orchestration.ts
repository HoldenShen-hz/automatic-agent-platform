/**
 * @fileoverview Multi-step orchestrator entrypoint.
 */

import type { StepOutputRecord } from "../../contracts/types/domain.js";
import { nowIso } from "../../contracts/types/ids.js";
import { executeMultiStepToolCallForTests, resetMultiStepToolRegistryForTests } from "../dispatcher/index.js";
import { provideContext } from "../../shared/context/runtime-context.js";
import { RoleToolExposureService } from "../tool-executor/role-tool-exposure-service.js";
import { executeStepLoop } from "./multi-step-supervisor.js";
import type {
  MultiStepOrchestrationResult,
  MultiStepToolExecutionInput,
} from "./multi-step-orchestration-types.js";
import {
  createOrchestrationBootstrapState,
  createOrchestrationRuntime,
  handleAdmissionDecision,
  persistOrchestrationBootstrap,
} from "./multi-step-orchestration-bootstrap-support.js";
import {
  finalizeOrchestrationResult,
  persistHarnessRunBootstrap,
} from "./multi-step-orchestration-finalize-support.js";
import {
  createOrchestrationTransitionContext,
  resolveOrchestrationPlan,
} from "./multi-step-orchestration-plan-support.js";

export {
  executeMultiStepToolCallForTests,
  resetMultiStepToolRegistryForTests,
};

export type {
  MultiStepOrchestrationResult,
  MultiStepToolExecutionInput,
  StepFailurePlan,
} from "./multi-step-orchestration-types.js";

export async function runMultiStepOrchestration(input: MultiStepToolExecutionInput): Promise<MultiStepOrchestrationResult> {
  const { resetToolRegistry } = await import("../dispatcher/index.js");
  resetToolRegistry();

  const { plannedWorkflow, routing } = resolveOrchestrationPlan(input);
  const runtime = createOrchestrationRuntime(input, plannedWorkflow);
  const bootstrap = createOrchestrationBootstrapState(input, plannedWorkflow);

  try {
    return await provideContext({
      traceId: bootstrap.traceId,
      spanId: bootstrap.traceContext.spanId,
      taskId: bootstrap.taskId,
      sessionId: bootstrap.sessionId,
      workflowId: plannedWorkflow.workflow.workflowId,
      divisionId: plannedWorkflow.workflow.divisionId,
    }, async () => {
      persistOrchestrationBootstrap({
        db: runtime.db,
        store: runtime.store,
        taskId: bootstrap.taskId,
        sessionId: bootstrap.sessionId,
        traceId: bootstrap.traceId,
        traceContext: bootstrap.traceContext,
        input,
        routing,
        plannedWorkflow,
        task: bootstrap.task,
        workflow: bootstrap.workflow,
        session: bootstrap.session,
      });

      const admissionDecision = runtime.admission.evaluate({
        priority: bootstrap.task.priority,
        estimatedCostUsd: bootstrap.task.estimatedCostUsd,
        budgetRemainingUsd: plannedWorkflow.executionSteps.length,
      });

      const earlyResult = handleAdmissionDecision({
        store: runtime.store,
        transitions: runtime.transitions,
        sessionId: bootstrap.sessionId,
        taskId: bootstrap.taskId,
        traceId: bootstrap.traceId,
        traceContext: bootstrap.traceContext,
        routing,
        plannedWorkflow,
        workflow: bootstrap.workflow,
        admissionDecision,
      });
      if (earlyResult != null) {
        return earlyResult;
      }

      runtime.transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: bootstrap.taskId,
        fromStatus: "queued",
        toStatus: "in_progress",
        executionId: null,
        ...createOrchestrationTransitionContext(bootstrap.traceContext, "task.started"),
      });
      runtime.transitions.transitionSessionStatus({
        entityKind: "session",
        entityId: bootstrap.sessionId,
        fromStatus: "open",
        toStatus: "streaming",
        ...createOrchestrationTransitionContext(bootstrap.traceContext, "session.streaming_started"),
      });

      const streamId = runtime.streamBridge.createStreamId(bootstrap.taskId, "cli");
      let outputs: Record<string, unknown> = {};
      let stepOutputs: StepOutputRecord[] = [];
      const toolExposureService = new RoleToolExposureService();
      let latestCompaction = null;
      const executionAttemptCounter = 0;
      let workflowRetryCount = 0;
      let workflowLastErrorCode: string | null = null;
      let blockedForDecision = false;
      let skippedStepIds = new Set<string>();
      let failedStepIds = new Set<string>();
      const harnessRunId = persistHarnessRunBootstrap({
        db: runtime.db,
        store: runtime.store,
        input,
        taskId: bootstrap.taskId,
        traceId: bootstrap.traceId,
        plannedWorkflow,
      });

      const stepResult = await executeStepLoop(
        {
          taskId: bootstrap.taskId,
          sessionId: bootstrap.sessionId,
          traceId: bootstrap.traceId,
          traceContext: bootstrap.traceContext,
          streamId,
          harnessRunId,
          admissionDecision,
          input,
          routing,
          plannedWorkflow,
          outputs,
          stepOutputs,
          toolExposureService,
          latestCompaction,
          executionAttemptCounter,
          workflowRetryCount,
          workflowLastErrorCode,
          blockedForDecision,
          skippedStepIds,
          failedStepIds,
        },
        {
          store: runtime.store,
          db: runtime.db,
          transitions: runtime.transitions,
          artifactStore: runtime.artifactStore,
          contextCompaction: runtime.contextCompaction,
          streamBridge: runtime.streamBridge,
          transitionExecutionStatus: runtime.transitions.transitionExecutionStatus.bind(runtime.transitions),
          createContext: (reasonCode: string) =>
            createOrchestrationTransitionContext(bootstrap.traceContext, reasonCode),
        },
      );

      ({ outputs, stepOutputs, latestCompaction, workflowRetryCount, workflowLastErrorCode, blockedForDecision, skippedStepIds, failedStepIds } = stepResult);

      if (blockedForDecision) {
        return {
          snapshot: runtime.store.operations.loadTaskSnapshot(bootstrap.taskId),
          streamFrames: runtime.streamBridge.replayAfterSequence(streamId, 0),
          routing,
          plannedWorkflow,
          compaction: latestCompaction,
        };
      }

      return runtime.db.transaction(() =>
        finalizeOrchestrationResult({
          taskId: bootstrap.taskId,
          sessionId: bootstrap.sessionId,
          streamId,
          traceId: bootstrap.traceId,
          traceContext: bootstrap.traceContext,
          plannedWorkflow,
          outputs,
          workflowLastErrorCode,
          latestCompaction,
          failedStepIds,
          skippedStepIds,
          store: runtime.store,
          transitions: runtime.transitions,
          streamBridge: runtime.streamBridge,
          routing,
        }),
      );
    });
  } finally {
    runtime.storage.close();
  }
}
