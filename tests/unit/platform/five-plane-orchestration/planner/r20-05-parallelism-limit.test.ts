/**
 * R20-05: Parallelism limit check test
 * Verifies PlanEvaluator checks parallelism vs worker pool capacity
 */

import { describe, it, expect } from 'node:test';
import { estimateMaxConcurrency } from '../../../../src/platform/five-plane-orchestration/planner/plan-evaluator.js';

describe('R20-05: Parallelism limit check', () => {
  it('should calculate max concurrency for linear plan (all steps sequential)', () => {
    // Linear: step1 -> step2 -> step3
    const plan = {
      planId: 'test-plan',
      taskId: 'test-task',
      version: 1,
      createdAt: Date.now(),
      strategy: 'linear' as const,
      steps: [
        { stepId: 'step1', action: 'read', timeout: 60000, retryPolicy: { maxRetries: 0, backoffMs: 250 }, dependencies: [] },
        { stepId: 'step2', action: 'execute', timeout: 60000, retryPolicy: { maxRetries: 0, backoffMs: 250 }, dependencies: ['step1'] },
        { stepId: 'step3', action: 'write', timeout: 60000, retryPolicy: { maxRetries: 0, backoffMs: 250 }, dependencies: ['step2'] },
      ],
      assessmentRef: 'assessment:test:1',
    };

    const maxConcurrency = estimateMaxConcurrency(plan);
    expect(maxConcurrency).toBe(1); // Only one step runs at a time
  });

  it('should calculate max concurrency for parallel plan (independent steps)', () => {
    // Parallel: all steps independent, can run together
    const plan = {
      planId: 'test-plan',
      taskId: 'test-task',
      version: 1,
      createdAt: Date.now(),
      strategy: 'linear' as const,
      steps: [
        { stepId: 'step1', action: 'read', timeout: 60000, retryPolicy: { maxRetries: 0, backoffMs: 250 }, dependencies: [] },
        { stepId: 'step2', action: 'execute', timeout: 60000, retryPolicy: { maxRetries: 0, backoffMs: 250 }, dependencies: [] },
        { stepId: 'step3', action: 'write', timeout: 60000, retryPolicy: { maxRetries: 0, backoffMs: 250 }, dependencies: [] },
      ],
      assessmentRef: 'assessment:test:1',
    };

    const maxConcurrency = estimateMaxConcurrency(plan);
    expect(maxConcurrency).toBe(3); // All 3 steps can run in parallel
  });

  it('should calculate max concurrency for diamond plan (join after parallel branches)', () => {
    // Diamond: step1 -> [step2, step3] -> step4
    const plan = {
      planId: 'test-plan',
      taskId: 'test-task',
      version: 1,
      createdAt: Date.now(),
      strategy: 'linear' as const,
      steps: [
        { stepId: 'step1', action: 'read', timeout: 60000, retryPolicy: { maxRetries: 0, backoffMs: 250 }, dependencies: [] },
        { stepId: 'step2', action: 'execute1', timeout: 60000, retryPolicy: { maxRetries: 0, backoffMs: 250 }, dependencies: ['step1'] },
        { stepId: 'step3', action: 'execute2', timeout: 60000, retryPolicy: { maxRetries: 0, backoffMs: 250 }, dependencies: ['step1'] },
        { stepId: 'step4', action: 'write', timeout: 60000, retryPolicy: { maxRetries: 0, backoffMs: 250 }, dependencies: ['step2', 'step3'] },
      ],
      assessmentRef: 'assessment:test:1',
    };

    const maxConcurrency = estimateMaxConcurrency(plan);
    expect(maxConcurrency).toBe(2); // step2 and step3 can run in parallel
  });
});