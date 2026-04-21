/**
 * Task Board Service
 *
 * ## Overview
 *
 * Provides visibility into the task queue for operators and monitoring systems.
 * Aggregates task information with workflow, session, and event status.
 *
 * ## Key Concepts
 *
 * - **Inspect**: Debug query view for task, execution, session, worker
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: inspect}
 *
 * - **Task Board**: Operator-facing view of pending/running tasks
 *
 * @see Observability Contract: docs_zh/contracts/debug_inspect_health_backpressure_contract.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 */
export class TaskBoardService {
    store;
    constructor(store) {
        this.store = store;
    }
    /**
     * Lists task board items with aggregated status information.
     * @param limit - Maximum number of items to return (default: 25)
     * @returns Array of task board items
     */
    list(limit = 25, tenantId) {
        return this.store.operations.listTaskBoardItems(limit, tenantId);
    }
}
//# sourceMappingURL=task-board-service.js.map