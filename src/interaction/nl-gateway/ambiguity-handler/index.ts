/**
 * Ambiguity Handler
 *
 * §39: Ambiguity detection for NL Gateway.
 * Provides ambiguity detection to determine when user input is too ambiguous
 * for automatic intent resolution and requires clarification.
 *
 * The canonical implementation is detectAmbiguity() in disambiguation-handler/index.ts.
 * This module provides backward-compatible re-export via the disambiguation-handler.
 *
 * @see docs_en/reviews/architecture-design-vs-implementation-review.md §39
 */

import { detectAmbiguity } from "../disambiguation-handler/index.js";

export { detectAmbiguity };

export interface AmbiguityOption {
  readonly optionId: string;
  readonly label: string;
  readonly intentHint: string;
}

export class AmbiguityHandler {
  public handleAmbiguity(message: string, _userId: string): AmbiguityOption[] {
    if (!detectAmbiguity(message, 0.5, 1, 0)) {
      return [];
    }
    return [
      { optionId: "create_task", label: "创建新任务", intentHint: "task_create" },
      { optionId: "query_status", label: "查询任务状态", intentHint: "status_inquiry" },
      { optionId: "modify_task", label: "修改现有任务", intentHint: "task_modify" },
    ];
  }
}
