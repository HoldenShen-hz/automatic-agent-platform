/**
 * Multi-step orchestration demonstration CLI.
 *
 * Runs a complete multi-step workflow orchestration demonstrating task routing,
 * step planning, execution, and streaming frame generation for a simple
 * analyze-draft-review task request.
 *
 * ## References
 * - Contract: {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/runtime_execution_contract.md Runtime Execution Contract}
 * - Related: {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/task_and_workflow_contract.md task_and_workflow_contract.md}
 * - Related: {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/workflow_static_analysis_and_compensation_contract.md workflow_static_analysis_and_compensation_contract.md}
 * - Glossary: {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md Glossary - task, workflow, step, execution, division, routing}
 * - Architecture: {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/architecture/00-platform-architecture.md 01_architecture_and_technical_design.md}
 *
 * @module
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { runMultiStepOrchestration } from "../../platform/five-plane-execution/execution-engine/multi-step-orchestration.js";

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

function toJsonSafe<T>(value: T): T {
  const seen = new WeakSet<object>();
  return JSON.parse(
    JSON.stringify(value, (_key, currentValue) => {
      if (typeof currentValue !== "object" || currentValue === null) {
        return currentValue;
      }
      if (seen.has(currentValue)) {
        return "[Circular]";
      }
      seen.add(currentValue);
      return currentValue;
    }),
  ) as T;
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

  process.stdout.write(`${JSON.stringify(
    {
      routing: toJsonSafe(result.routing),
      plannedSteps: result.plannedWorkflow.executionSteps.map((step) => ({
        stepId: step.stepId,
        roleId: step.roleId,
        dependsOnStepIds: step.dependsOnStepIds,
      })),
      task: {
        id: result.snapshot.task.id,
        status: result.snapshot.task.status,
      },
      workflow: toJsonSafe(result.snapshot.workflow),
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
  )}\n`);
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
