/**
 * Single-Task Execution Demo Entry Point
 *
 * Purpose: Run the minimal stable single-agent execution baseline.
 * This demonstrates core runtime infrastructure including task creation,
 * single-step workflow execution, and structured output generation.
 *
 * Architecture: the single-task execution flow implements the core runtime execution chain with
 * task creation from user input, single-step workflow execution (intake_triage),
 * and direct output without multi-step orchestration.
 *
 * @see Single-Task Execution: src/core/runtime/single-task-execution.ts
 * @see Platform Architecture: docs_zh/architecture/00-platform-architecture.md
 * @see Runtime Execution Contract: docs_zh/contracts/runtime_execution_contract.md
 * @see Task and Workflow Contract: docs_zh/contracts/task_and_workflow_contract.md
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { requireValidStartupEnv } from "./platform/control-plane/config-center/startup-env-schema.js";
import { runSingleTaskExecution } from "./platform/execution/execution-engine/single-task-execution.js";
/**
 * Resolves the SQLite database path and ensures the directory exists.
 *
 * Purpose: The demo requires a persistent SQLite database. This function
 * creates the data/sqlite directory structure if missing and returns the
 * path to the demo database file.
 *
 * @returns The absolute path to the single-task demo database file
 */
function resolveDbPath() {
    const base = process.cwd();
    const sqliteDir = join(base, "data", "sqlite");
    mkdirSync(sqliteDir, { recursive: true });
    return join(sqliteDir, "single-task-demo.db");
}
/**
 * Main entry point for the single-task execution demo.
 *
 * Purpose: Execute the happy path demo and output structured JSON results.
 * This runs the single-agent baseline execution with a minimal task request,
 * then outputs task, workflow, execution, session, and event summary data.
 */
async function main() {
    // GAP-V2-06: Validate startup environment variables before any other logic.
    // process.exit(1) if critical env vars are invalid or missing.
    requireValidStartupEnv();
    const snapshot = await runSingleTaskExecution({
        dbPath: resolveDbPath(),
        title: "Single-task execution baseline",
        request: "Create the minimal stable single-agent execution baseline.",
    });
    console.log(JSON.stringify({
        task: {
            id: snapshot.task.id,
            status: snapshot.task.status,
            output: snapshot.task.outputJson ? JSON.parse(snapshot.task.outputJson) : null,
        },
        workflow: snapshot.workflow
            ? {
                status: snapshot.workflow.status,
                currentStepIndex: snapshot.workflow.currentStepIndex,
            }
            : null,
        execution: snapshot.execution
            ? {
                id: snapshot.execution.id,
                status: snapshot.execution.status,
                traceId: snapshot.execution.traceId,
            }
            : null,
        session: snapshot.session
            ? {
                id: snapshot.session.id,
                status: snapshot.session.status,
            }
            : null,
        stepOutputs: snapshot.stepOutputs.length,
        events: snapshot.events.map((event) => ({
            eventType: event.eventType,
            eventTier: event.eventTier,
        })),
    }, null, 2));
}
main();
//# sourceMappingURL=index.js.map