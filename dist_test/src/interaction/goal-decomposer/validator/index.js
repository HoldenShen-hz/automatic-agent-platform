import { detectDependencyCycle } from "../dependency-graph/index.js";
export function validateGoalDecomposition(input) {
    const findings = [];
    if (input.tasks.length === 0) {
        findings.push("goal_decomposition.empty_tasks");
    }
    if (input.decompositionConfidence < 0 || input.decompositionConfidence > 1) {
        findings.push("goal_decomposition.invalid_confidence");
    }
    const taskIds = new Set(input.tasks.map((item) => item.taskId));
    const edges = input.dependencyGraph.map((item) => ({ fromTask: item.fromTask, toTask: item.toTask }));
    // Validate dependsOn references
    for (const task of input.tasks) {
        if (task.dependsOn) {
            for (const depId of task.dependsOn) {
                if (!taskIds.has(depId)) {
                    findings.push(`goal_decomposition.invalid_depends_on: task ${task.taskId} depends on non-existent task ${depId}`);
                }
                if (depId === task.taskId) {
                    findings.push(`goal_decomposition.self_dependency: task ${task.taskId} depends on itself`);
                }
            }
        }
    }
    if (detectDependencyCycle([...taskIds], edges)) {
        findings.push("goal_decomposition.cycle_detected");
    }
    // Warn if max depth was reached
    if (input.maxDepthReached) {
        findings.push("goal_decomposition.max_depth_reached");
    }
    return findings;
}
//# sourceMappingURL=index.js.map