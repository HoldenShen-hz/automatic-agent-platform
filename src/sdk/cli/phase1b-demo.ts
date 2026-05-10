/**
 * Multi-step orchestration demonstration CLI.
 *
 * Runs a complete multi-step workflow orchestration demonstrating task routing,
 * step planning, execution, and streaming frame generation for a simple
 * analyze-draft-review task request.
 *
 * ## References
 * - Contract: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/contracts/runtime_execution_contract.md Runtime Execution Contract}
 * - Related: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/contracts/task_and_workflow_contract.md task_and_workflow_contract.md}
 * - Related: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/contracts/workflow_static_analysis_and_compensation_contract.md workflow_static_analysis_and_compensation_contract.md}
 * - Glossary: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/governance/glossary_and_terminology.md Glossary - task, workflow, step, execution, division, routing}
 * - Architecture: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/architecture/00-platform-architecture.md 01_architecture_and_technical_design.md}
 *
 * @module
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { runMultiStepOrchestration } from "../../platform/execution/execution-engine/multi-step-orchestration.js";

/**
 * Resolves the path to the SQLite database file for the multi-step demo.
 *
 * Constructs a default path under data/sqlite/ in the current working directory
 * using the multi-step-demo.db filename. Creates the sqlite directory if it does
 * not exist (recursive creation).
 *
 * @returns The absolute path to the SQLite database file
 */
function resolveDbPath(): string {
  const base = process.cwd();
  const sqliteDir = join(base, "data", "sqlite");
  mkdirSync(sqliteDir, { recursive: true });
  return join(sqliteDir, "multi-step-demo.db");
}

/**
 * Main entry point for the multi-step orchestration demo CLI.
 *
 * Runs a complete multi-step workflow orchestration demonstrating task routing,
 * step planning, execution, and streaming frame generation for a simple
 * analyze-draft-review task request. Outputs routing decisions, planned steps,
 * task/workflow state, step outputs, and stream frames as formatted JSON.
 */
async function main(): Promise<void> {
  const result = await runMultiStepOrchestration({
    dbPath: resolveDbPath(),
    title: "Multi-step orchestration demo",
    request: "Analyze the task, draft a solution, and review the final output before completion.",
  });

  console.log(
    JSON.stringify(
      {
        routing: result.routing,
        plannedSteps: result.plannedWorkflow.executionSteps.map((step) => ({
          stepId: step.stepId,
          roleId: step.roleId,
          dependsOnStepIds: step.dependsOnStepIds,
        })),
        task: {
          id: result.snapshot.task.id,
          status: result.snapshot.task.status,
        },
        workflow: result.snapshot.workflow,
        stepOutputs: result.snapshot.stepOutputs.map((step) => ({
          nodeRunId: step.nodeRunId,
          stepId: step.stepId,
          roleId: step.roleId,
          summary: step.summary,
        })),
        streamFrames: result.streamFrames.map((frame) => ({
          sequence: frame.sequence,
          eventType: frame.eventType,
        })),
      },
      null,
      2,
    ),
  );
}

main();
