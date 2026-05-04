import type { Plan } from "../oapeflir/types/index.js";

export class PlanRepository {
  private readonly plansByTask = new Map<string, Plan[]>();

  public save(plan: Plan): void {
    // R29-10 FIX: Add deduplication by planId to prevent duplicate entries.
    // Root cause: save() blindly pushed plan to existing array without checking if a plan
    // with the same planId already exists. This caused duplicate plan entries when the same
    // plan was saved multiple times (e.g., during replanning).
    const existing = this.plansByTask.get(plan.taskId) ?? [];
    const existingIndex = existing.findIndex((p) => p.planId === plan.planId);
    if (existingIndex >= 0) {
      // Update existing plan with same planId
      existing[existingIndex] = plan;
    } else {
      // Add new plan
      existing.push(plan);
    }
    existing.sort((left, right) => left.version - right.version);
    this.plansByTask.set(plan.taskId, existing);
  }

  public listByTask(taskId: string): Plan[] {
    return [...(this.plansByTask.get(taskId) ?? [])];
  }

  public latest(taskId: string): Plan | null {
    const plans = this.plansByTask.get(taskId) ?? [];
    return plans.at(-1) ?? null;
  }
}
