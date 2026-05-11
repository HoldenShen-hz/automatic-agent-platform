import type {
  TaskMetricSnapshot,
  WorkflowMetricSnapshot,
  SystemHealthSnapshot,
  QueueMetricSnapshot,
  CostMetricSnapshot,
} from "./index.js";

export interface MetricSample {
  readonly timestamp: number;
  readonly metrics: AggregatableMetrics;
}

export type AggregatableMetrics =
  | { type: "task"; snapshot: TaskMetricSnapshot }
  | { type: "workflow"; snapshot: WorkflowMetricSnapshot }
  | { type: "system"; snapshot: SystemHealthSnapshot }
  | { type: "queue"; snapshot: QueueMetricSnapshot }
  | { type: "cost"; snapshot: CostMetricSnapshot };

export interface AggregatedMetrics {
  readonly task: TaskMetricSnapshot;
  readonly workflow: WorkflowMetricSnapshot;
  readonly system: SystemHealthSnapshot;
  readonly queue: QueueMetricSnapshot;
  readonly cost: CostMetricSnapshot;
  readonly sampleCount: number;
  readonly oldestSampleMs: number | null;
  readonly newestSampleMs: number | null;
}

/**
 * Rolling window aggregator for multi-type metric samples.
 * Uses a circular buffer for O(1) insertions and O(1) window eviction.
 * Performance target: >3000 ops/sec.
 */
export class MetricAggregator {
  private buffer: (MetricSample | undefined)[];
  private head = 0; // next write position
  private count = 0;
  private readonly windowSize: number;

  constructor(windowSize = 60_000) {
    this.windowSize = windowSize;
    this.buffer = new Array(4096);
  }

  /**
   * Incorporate incremental metric samples into the rolling window.
   * Automatically evicts samples outside the window.
   */
  aggregate({ metrics, windowMs }: { metrics: AggregatableMetrics; windowMs?: number }): void {
    const now = Date.now();
    const effectiveWindow = windowMs ?? this.windowSize;

    // Evict stale samples before inserting
    const cutoff = now - effectiveWindow;
    this.evictStale(cutoff);

    // Expand buffer if needed (double capacity)
    if (this.count >= this.buffer.length) {
      const newBuffer = new Array<MetricSample | undefined>(this.buffer.length * 2);
      const oldestIndex = this.getOldestIndex();
      for (let i = 0; i < this.count; i++) {
        newBuffer[i] = this.buffer[(oldestIndex + i) % this.buffer.length];
      }
      this.buffer = newBuffer;
      this.head = this.count;
    }

    this.buffer[this.head] = { timestamp: now, metrics };
    this.head = (this.head + 1) % this.buffer.length;
    this.count++;
  }

  /**
   * Returns the current aggregated metrics for the active window.
   * Returns null values for each metric type when no samples are present.
   */
  getWindow(): AggregatedMetrics {
    const now = Date.now();
    const cutoff = now - this.windowSize;
    this.evictStale(cutoff);

    let taskTotal = 0;
    let taskDone = 0;
    let taskInProgress = 0;
    let taskFailed = 0;
    let taskPending = 0;
    let taskCancelled = 0;

    let workflowTotal = 0;
    let workflowActive = 0;
    let workflowCompleted = 0;
    let workflowFailed = 0;
    let workflowCancelled = 0;
    let workflowStepSum = 0;
    let workflowStepCount = 0;
    const workflowSteps: number[] = [];

    let systemScoreSum = 0;
    let systemCount = 0;
    const systemScores: number[] = [];
    let systemQueueBacklogSum = 0;
    let systemFindingSum = 0;
    const systemProviderHealthScores: number[] = [];
    const systemProviderSuccessRates: number[] = [];

    let queueTotalDepth = 0;
    let queueTotalEnqueued = 0;
    let queueTotalDequeued = 0;
    let queueTotalFailed = 0;
    let queueWaitTimeSum = 0;
    let queueWaitTimeCount = 0;
    const queueP95WaitTimes: number[] = [];

    let costTotal = 0;
    let costCount = 0;
    const costPerDomain = new Map<string, number>();
    const costPerAgent = new Map<string, number>();

    for (let i = 0; i < this.count; i++) {
      const idx = (this.getOldestIndex() + i) % this.buffer.length;
      const sample = this.buffer[idx];
      if (!sample) continue;
      switch (sample.metrics.type) {
        case "task": {
          const m = sample.metrics.snapshot;
          taskTotal += m.total;
          taskDone += m.done;
          taskInProgress += m.inProgress;
          taskFailed += m.failed;
          taskPending += m.pending;
          taskCancelled += m.cancelled;
          break;
        }
        case "workflow": {
          const m = sample.metrics.snapshot;
          workflowTotal += m.total;
          workflowActive += m.active;
          workflowCompleted += m.completed;
          workflowFailed += m.failed;
          workflowCancelled += m.cancelled;
          workflowStepSum += m.averageStepCount * m.total;
          workflowStepCount += m.total;
          if (m.p95StepCount > 0) workflowSteps.push(m.p95StepCount);
          break;
        }
        case "system": {
          const m = sample.metrics.snapshot;
          systemScoreSum += m.score;
          systemCount++;
          systemScores.push(m.score);
          systemQueueBacklogSum += m.queueBacklogSize;
          systemFindingSum += m.findingCount;
          systemProviderHealthScores.push(
            m.providerHealthStatus === "healthy" ? 1 : m.providerHealthStatus === "degraded" ? 0.5 : 0
          );
          systemProviderSuccessRates.push(m.providerSuccessRate);
          break;
        }
        case "queue": {
          const m = sample.metrics.snapshot;
          queueTotalDepth += m.totalDepth;
          queueTotalEnqueued += m.totalEnqueuedPerMinute;
          queueTotalDequeued += m.totalDequeuedPerMinute;
          queueTotalFailed += m.totalFailedJobs;
          queueWaitTimeSum += m.averageWaitTimeMs;
          queueWaitTimeCount++;
          if (m.p95WaitTimeMs > 0) queueP95WaitTimes.push(m.p95WaitTimeMs);
          break;
        }
        case "cost": {
          const m = sample.metrics.snapshot;
          costTotal += m.totalCostUsd;
          costCount++;
          m.costPerDomain.forEach((v, k) => costPerDomain.set(k, (costPerDomain.get(k) ?? 0) + v));
          m.costPerAgent.forEach((v, k) => costPerAgent.set(k, (costPerAgent.get(k) ?? 0) + v));
          break;
        }
      }
    }

    let oldestSampleMs: number | null = null;
    let newestSampleMs: number | null = null;
    if (this.count > 0) {
      oldestSampleMs = Infinity;
      newestSampleMs = -Infinity;
      for (let i = 0; i < this.count; i++) {
        const sample = this.buffer[(this.getOldestIndex() + i) % this.buffer.length];
        if (sample) {
          if (sample.timestamp < oldestSampleMs) oldestSampleMs = sample.timestamp;
          if (sample.timestamp > newestSampleMs) newestSampleMs = sample.timestamp;
        }
      }
      if (oldestSampleMs === Infinity) oldestSampleMs = null;
      if (newestSampleMs === -Infinity) newestSampleMs = null;
    }

    const avgScore = systemCount > 0 ? systemScoreSum / systemCount : 0;
    const avgQueueWait = queueWaitTimeCount > 0 ? queueWaitTimeSum / queueWaitTimeCount : 0;
    const sortedScore = systemScores.length > 0 ? [...systemScores].sort((a, b) => a - b) : [];
    const p95ScoreIdx = Math.floor(sortedScore.length * 0.95);
    const p95Score = sortedScore.length > 0 ? (sortedScore[p95ScoreIdx] ?? sortedScore[sortedScore.length - 1]!) : 0;

    const sortedP95Wait = queueP95WaitTimes.length > 0 ? [...queueP95WaitTimes].sort((a, b) => a - b) : [];
    const p95WaitIdx = Math.floor(sortedP95Wait.length * 0.95);
    const p95QueueWait = sortedP95Wait.length > 0 ? (sortedP95Wait[p95WaitIdx] ?? sortedP95Wait[sortedP95Wait.length - 1]!) : 0;

    const avgProviderHealth =
      systemProviderHealthScores.length > 0
        ? systemProviderHealthScores.reduce((s, v) => s + v, 0) / systemProviderHealthScores.length
        : 1;
    const avgProviderSuccessRate =
      systemProviderSuccessRates.length > 0
        ? systemProviderSuccessRates.reduce((s, v) => s + v, 0) / systemProviderSuccessRates.length
        : 1;

    const healthStatus: "ok" | "degraded" | "unhealthy" =
      avgScore >= 0.8 ? "ok" : avgScore >= 0.5 ? "degraded" : "unhealthy";

    const avgWorkflowSteps = workflowStepCount > 0 ? workflowStepSum / workflowStepCount : 0;
    const sortedWorkflowSteps = workflowSteps.length > 0 ? [...workflowSteps].sort((a, b) => a - b) : [];
    const p95WorkflowStepsIdx = Math.floor(sortedWorkflowSteps.length * 0.95);
    const p95WorkflowSteps =
      sortedWorkflowSteps.length > 0
        ? (sortedWorkflowSteps[p95WorkflowStepsIdx] ?? sortedWorkflowSteps[sortedWorkflowSteps.length - 1]!)
        : 0;

    const costTrend: "increasing" | "stable" | "decreasing" = "stable";

    return {
      task: {
        total: taskTotal,
        done: taskDone,
        inProgress: taskInProgress,
        failed: taskFailed,
        pending: taskPending,
        cancelled: taskCancelled,
      },
      workflow: {
        total: workflowTotal,
        active: workflowActive,
        completed: workflowCompleted,
        failed: workflowFailed,
        cancelled: workflowCancelled,
        averageStepCount: avgWorkflowSteps,
        p95StepCount: p95WorkflowSteps,
      },
      system: {
        score: avgScore,
        status: healthStatus,
        queueBacklogSize: systemQueueBacklogSum,
        findingCount: systemFindingSum,
        providerHealthStatus:
          avgProviderHealth >= 0.8 ? "healthy" : avgProviderHealth >= 0.5 ? "degraded" : "failed",
        providerSuccessRate: avgProviderSuccessRate,
      },
      queue: {
        totalQueues: this.count,
        totalDepth: queueTotalDepth,
        totalEnqueuedPerMinute: queueTotalEnqueued,
        totalDequeuedPerMinute: queueTotalDequeued,
        averageWaitTimeMs: avgQueueWait,
        p95WaitTimeMs: p95QueueWait,
        totalFailedJobs: queueTotalFailed,
        overallSuccessRate:
          queueTotalEnqueued > 0 ? (queueTotalEnqueued - queueTotalFailed) / queueTotalEnqueued : 1,
      },
      cost: {
        totalCostUsd: costTotal,
        costPerDomain,
        costPerAgent,
        costTrend,
        forecastCostUsd: costTotal,
        budgetUtilizationPercent: 0,
      },
      sampleCount: this.count,
      oldestSampleMs,
      newestSampleMs,
    };
  }

  private evictStale(cutoff: number): void {
    while (this.count > 0) {
      const oldestIndex = this.getOldestIndex();
      const oldest = this.buffer[oldestIndex];
      if (oldest && oldest.timestamp >= cutoff) break;
      this.buffer[oldestIndex] = undefined;
      this.count--;
    }
  }

  private getOldestIndex(): number {
    return (this.head - this.count + this.buffer.length) % this.buffer.length;
  }
}
