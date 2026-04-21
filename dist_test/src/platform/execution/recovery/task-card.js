/**
 * TaskCard - Structured Task Definition
 *
 * A structured representation of a task that constrains the agent's
 * decision space and enables verification. Every task entering the
 * system must be represented as a TaskCard.
 */
export function createTaskCard(input) {
    const { taskId, title, objective, riskLevel, allowedPaths = ['*'], forbiddenPaths = ['**/secrets/**', '**/auth/**', '**/billing/**'], maxChangedFiles = riskLevel === 'critical' ? 1 : riskLevel === 'high' ? 3 : 10, maxDiffLines = riskLevel === 'critical' ? 50 : riskLevel === 'high' ? 100 : 300, requiredChecks = [], releaseStrategy = defaultReleaseStrategy(riskLevel), maxRepairRounds = riskLevel === 'critical' ? 0 : riskLevel === 'high' ? 1 : 2, deadlineAt, } = input;
    return {
        taskId,
        title,
        objective,
        riskLevel,
        stage: 'plan',
        allowedPaths,
        forbiddenPaths,
        maxChangedFiles,
        maxDiffLines,
        requiredChecks,
        releaseStrategy,
        maxRepairRounds,
        createdAt: new Date().toISOString(),
        ...(deadlineAt !== undefined && { deadlineAt }),
    };
}
function defaultReleaseStrategy(riskLevel) {
    return {
        requireFeatureFlag: riskLevel !== 'low',
        requireHumanGate: riskLevel === 'critical' || riskLevel === 'high',
        allowedEnvironments: riskLevel === 'low' ? ['development', 'staging', 'production']
            : riskLevel === 'medium' ? ['development', 'staging']
                : ['development'],
    };
}
export function validateTaskCard(card) {
    const errors = [];
    if (!card.taskId)
        errors.push('taskId is required');
    if (!card.objective)
        errors.push('objective is required');
    if (!card.riskLevel)
        errors.push('riskLevel is required');
    if (card.maxChangedFiles < 1)
        errors.push('maxChangedFiles must be >= 1');
    if (card.maxDiffLines < 1)
        errors.push('maxDiffLines must be >= 1');
    if (card.maxRepairRounds < 0)
        errors.push('maxRepairRounds must be >= 0');
    return {
        valid: errors.length === 0,
        errors,
    };
}
//# sourceMappingURL=task-card.js.map