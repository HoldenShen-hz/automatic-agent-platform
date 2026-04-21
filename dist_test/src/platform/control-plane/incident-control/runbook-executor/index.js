/**
 * Runbook Executor Module
 *
 * Provides:
 * - Markdown runbook parsing
 * - Step-by-step runbook execution
 * - Incident drill simulation
 *
 * ## Usage
 *
 * ### Parsing and Executing a Runbook
 *
 * ```typescript
 * import { RunbookExecutor } from "./runbook-executor/index.js";
 *
 * const executor = new RunbookExecutor({ autoExecute: false });
 *
 * const runbook = executor.parse(markdownContent);
 * const execution = executor.initializeExecution(runbook, "operator-1");
 *
 * // Execute steps
 * await executor.executeStep(execution.executionId, "Mitigation", 0);
 *
 * // Generate report
 * const report = executor.generateExecutionReport(execution);
 * ```
 *
 * ### Running an Incident Drill
 *
 * ```typescript
 * import { IncidentDrillService } from "./runbook-executor/index.js";
 *
 * const drillService = new IncidentDrillService(executor);
 *
 * const scenario = drillService.getScenario("worker_mass_disconnect_drill")!;
 * const drill = drillService.initializeDrill(scenario, ["operator-1", "operator-2"], "drill-initiator");
 *
 * drillService.startDrill();
 * drillService.recordObservation("operator-1", "decision", "Identified worker disconnect", "good");
 *
 * drillService.completeDrill([], ["Improve detection time"], []);
 * ```
 */
export * from "./types.js";
export * from "./markdown-parser.js";
export * from "./runbook-executor.js";
export * from "./incident-drill-service.js";
//# sourceMappingURL=index.js.map