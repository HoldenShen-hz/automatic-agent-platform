/**
 * Task timeline aggregation service for observability and debugging.
 *
 * Builds a chronological timeline of all events, step outputs, approvals, and artifacts
 * associated with a task, providing a unified view for inspect and diagnostics.
 *
 * ## References
 * - Contract: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/contracts/observability_contract.md Observability Contract}
 * - Related: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/contracts/trace_and_root_cause_observability_contract.md trace_and_root_cause_observability_contract.md}
 * - Related: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/contracts/debug_inspect_health_backpressure_contract.md debug_inspect_health_backpressure_contract.md}
 * - Glossary: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/governance/glossary_and_terminology.md Glossary - task, workflow, step, execution, artifact, trace, inspect}
 * - Architecture: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/architecture/00-platform-architecture.md 01_architecture_and_technical_design.md}
 *
 * @module
 */
import { InspectService, type TaskInspectView } from "./inspect-service.js";
export interface TaskTimelineEntry {
    id: string;
    kind: "event" | "step_output" | "approval" | "artifact" | "dispatch" | "remote_log";
    occurredAt: string;
    title: string;
    summary: string;
    status?: string;
    traceId?: string | null;
    spanId?: string | null;
    parentSpanId?: string | null;
    correlationId?: string | null;
    data: Record<string, unknown>;
}
export declare class TaskTimelineService {
    private readonly inspectService;
    constructor(inspectService: InspectService);
    buildTaskTimeline(taskId: string): {
        taskId: string;
        entries: TaskTimelineEntry[];
        inspect: TaskInspectView;
    };
}
