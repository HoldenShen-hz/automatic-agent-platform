import type { TransitionAuditContext } from "../../contracts/types/domain.js";
import { nowIso } from "../../contracts/types/ids.js";
import { createChildTraceContext, createRootTraceContext } from "../../shared/observability/trace-context.js";
import { IntakeRouter } from "../../five-plane-orchestration/routing/intake-router.js";
import { WorkflowPlanner } from "../../five-plane-orchestration/routing/workflow-planner.js";
import { assertWorkflowValid } from "../../five-plane-orchestration/oapeflir/workflow/workflow-validator.js";
import type { MultiStepToolExecutionInput } from "./multi-step-orchestration-types.js";
import {
  buildOapeflirPlannedWorkflow,
  deserializeOapeflirPlan,
  isOapeflirPlanRequest,
} from "./multi-step-oapeflir-plan.js";

export interface OrchestrationPlanResolution {
  plannedWorkflow: ReturnType<WorkflowPlanner["plan"]>;
  routing: ReturnType<IntakeRouter["route"]>;
}

export function createOrchestrationTransitionContext(
  traceContext: ReturnType<typeof createRootTraceContext>,
  reasonCode: string,
): TransitionAuditContext {
  const span = createChildTraceContext(traceContext);
  const context: TransitionAuditContext = {
    reasonCode,
    traceId: span.traceId,
    parentSpanId: span.parentSpanId,
    actorType: "system",
    occurredAt: nowIso(),
  };
  if (span.spanId != null) {
    context.spanId = span.spanId;
  }
  if (span.correlationId != null) {
    context.correlationId = span.correlationId;
  }
  return context;
}

export function resolveOrchestrationPlan(input: MultiStepToolExecutionInput): OrchestrationPlanResolution {
  if (isOapeflirPlanRequest(input.request)) {
    const oapeflirSteps = deserializeOapeflirPlan(input.request);
    const plannedWorkflow = buildOapeflirPlannedWorkflow(oapeflirSteps, input.title);
    return {
      plannedWorkflow,
      routing: {
        workflowId: plannedWorkflow.workflow.workflowId,
        divisionId: plannedWorkflow.workflow.divisionId,
        routeReason: "oapeflir_bridge",
        routeTrace: ["oapeflir_bridge:bypass"],
        requiresOrchestration: true,
        classification: {
          intent: "create" as const,
          confidence: 1.0,
          continuation: "new_task" as const,
          matchedRules: [] as string[],
        },
      },
    };
  }

  const router = input.intakeRouter ?? new IntakeRouter();
  const routing = router.route({ title: input.title, request: input.request });
  const planner = input.workflowPlanner ?? new WorkflowPlanner();
  const plannedWorkflow = planner.plan({ workflowId: routing.workflowId, request: input.request });
  assertWorkflowValid(plannedWorkflow.workflow);
  return { plannedWorkflow, routing };
}
