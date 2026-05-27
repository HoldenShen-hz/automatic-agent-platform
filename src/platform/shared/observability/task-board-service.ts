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
 *   * See: {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: inspect}
 *
 * - **Task Board**: Operator-facing view of pending/running tasks
 *
 * @see Observability Contract: docs_zh/contracts/debug_inspect_health_backpressure_contract.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 */

import type { TaskBoardItem } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";

export class TaskBoardService {
  public constructor(private readonly store: AuthoritativeTaskStore) {}

  /**
   * Lists task board items with aggregated status information.
   * @param limit - Maximum number of items to return (default: 25)
   * @returns Array of task board items
   */
  public list(limit: number = 25, tenantId?: string | null): TaskBoardItem[] {
    return this.store.operations.listTaskBoardItems(limit, tenantId);
  }
}
