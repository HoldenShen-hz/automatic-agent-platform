export class PlanRepository {
    plansByTask = new Map();
    save(plan) {
        const existing = this.plansByTask.get(plan.taskId) ?? [];
        existing.push(plan);
        existing.sort((left, right) => left.version - right.version);
        this.plansByTask.set(plan.taskId, existing);
    }
    listByTask(taskId) {
        return [...(this.plansByTask.get(taskId) ?? [])];
    }
    latest(taskId) {
        const plans = this.plansByTask.get(taskId) ?? [];
        return plans.at(-1) ?? null;
    }
}
//# sourceMappingURL=plan-repository.js.map