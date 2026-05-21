/**
 * Queue Metrics Module
 *
 * Provides queue metrics aggregation services and collectors for observability.
 * Tracks queue depth, throughput, wait times, and failure rates.
 */

import { MS_PER_HOUR } from "../../contracts/constants/time.js";
import type { QueueStats } from "../../five-plane-execution/queue/queue-adapter-types.js";

/**
 * Individual queue metrics snapshot with throughput and latency statistics.
 */
export interface QueueMetrics {
  queueName: string;
  depth: number;
  enqueuedPerMinute: number;
  dequeuedPerMinute: number;
  averageWaitTimeMs: number;
}

/**
 * Aggregated metrics snapshot across all queues.
 */
export interface QueueMetricsSnapshot {
  timestamp: string;
  queues: Map<string, number>;
  enqueuedPerMinute: Map<string, number>;
  dequeuedPerMinute: Map<string, number>;
  averageWaitTimeMs: Map<string, number>;
  p95WaitTimeMs: Map<string, number>;
  failedJobs: Map<string, number>;
  successRate: Map<string, number>;
}

/**
 * QueueMetricCollector tracks metrics for a single queue.
 * R9-21 fix: Added TTL-based eviction for waitTimes/failureReasons arrays
 * to prevent unbounded memory growth.
 */
export class QueueMetricCollector {
  private enqueued = 0;
  private dequeued = 0;
  private failed = 0;
  private waitTimes: { value: number; timestamp: number }[] = [];
  private failureReasons: { value: string; timestamp: number }[] = [];
  private readonly ttlMs: number;
  private readonly maxSize: number;

  public constructor(
    public readonly queueName: string,
    options: { ttlMs?: number; maxSize?: number } = {},
  ) {
    this.ttlMs = options.ttlMs ?? MS_PER_HOUR;
    this.maxSize = options.maxSize ?? 10000; // Default max 10000 entries
  }

  private evictOldEntries(): void {
    const now = Date.now();
    const cutoff = now - this.ttlMs;
    this.waitTimes = this.waitTimes.filter((e) => e.timestamp > cutoff);
    this.failureReasons = this.failureReasons.filter((e) => e.timestamp > cutoff);
  }

  public evictExpiredWaitTimes(): void {
    const cutoff = Date.now() - this.ttlMs;
    this.waitTimes = this.waitTimes.filter((entry) => entry.value > cutoff);
    if (this.waitTimes.length > this.maxSize) {
      this.waitTimes = this.waitTimes.slice(-this.maxSize);
    }
  }

  public recordEnqueue(): void {
    this.enqueued += 1;
  }

  public recordDequeue(): void {
    this.dequeued += 1;
  }

  public recordFailed(reason: string): void {
    this.failed += 1;
    this.evictOldEntries();
    this.failureReasons.push({ value: reason, timestamp: Date.now() });
    // Safety bound: trim to maxSize if exceeded
    if (this.failureReasons.length > this.maxSize) {
      this.failureReasons = this.failureReasons.slice(-this.maxSize);
    }
  }

  public recordWaitTime(waitTimeMs: number): void {
    this.evictOldEntries();
    this.waitTimes.push({ value: waitTimeMs, timestamp: Date.now() });
    // Safety bound: trim to maxSize if exceeded
    if (this.waitTimes.length > this.maxSize) {
      this.waitTimes = this.waitTimes.slice(-this.maxSize);
    }
  }

  public snapshot(): {
    queueName: string;
    timestamp: number;
    totalEnqueued: number;
    totalDequeued: number;
    totalFailed: number;
    depth: number;
    averageWaitTimeMs: number;
    p95WaitTimeMs: number;
    p99WaitTimeMs: number;
    waitTimes: number[];
    failureReasons: string[];
    enqueuedPerMinute: number;
    dequeuedPerMinute: number;
    throughputPerMinute: number;
    failureRate: number;
    successRate: number;
  } {
    const depth = this.enqueued - this.dequeued;
    const waitTimeValues = this.waitTimes.map((e) => e.value);
    const avgWaitTime =
      waitTimeValues.length > 0
        ? waitTimeValues.reduce((sum, t) => sum + t, 0) / waitTimeValues.length
        : 0;
    const sortedWaitTimes = [...waitTimeValues].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedWaitTimes.length * 0.95);
    const p99Index = Math.floor(sortedWaitTimes.length * 0.99);
    const p95WaitTime =
      sortedWaitTimes.length > 0 ? sortedWaitTimes[p95Index] ?? sortedWaitTimes[sortedWaitTimes.length - 1]! : 0;
    const p99WaitTime =
      sortedWaitTimes.length > 0 ? sortedWaitTimes[p99Index] ?? sortedWaitTimes[sortedWaitTimes.length - 1]! : 0;

    return {
      queueName: this.queueName,
      timestamp: Date.now(),
      totalEnqueued: this.enqueued,
      totalDequeued: this.dequeued,
      totalFailed: this.failed,
      depth,
      averageWaitTimeMs: avgWaitTime,
      p95WaitTimeMs: p95WaitTime,
      p99WaitTimeMs: p99WaitTime,
      waitTimes: waitTimeValues,
      failureReasons: this.failureReasons.map((e) => e.value),
      enqueuedPerMinute: this.enqueued,
      dequeuedPerMinute: this.dequeued,
      throughputPerMinute: this.enqueued - this.dequeued,
      failureRate: this.enqueued > 0 ? this.failed / this.enqueued : 0,
      successRate: this.enqueued > 0 ? (this.enqueued - this.failed) / this.enqueued : 0,
    };
  }

  public reset(): void {
    this.enqueued = 0;
    this.dequeued = 0;
    this.failed = 0;
    this.waitTimes = [];
    this.failureReasons = [];
  }
}

/**
 * QueueMetricsService aggregates metrics across multiple queues.
 */
export class QueueMetricsService {
  private readonly queueCollectors = new Map<string, QueueMetricCollector>();
  private readonly depthByQueue = new Map<string, number>();
  private readonly enqueuedByQueue = new Map<string, number>();
  private readonly dequeuedByQueue = new Map<string, number>();
  private readonly waitTimeByQueue = new Map<string, number[]>();
  private readonly failedByQueue = new Map<string, number>();
  private readonly timestampsByQueue = new Map<string, number[]>();

  public recordDepth(queueName: string, depth: number): void {
    this.depthByQueue.set(queueName, depth);
  }

  public recordEnqueue(queueName: string): void {
    const current = this.enqueuedByQueue.get(queueName) ?? 0;
    this.enqueuedByQueue.set(queueName, current + 1);
  }

  public recordDequeue(queueName: string): void {
    const current = this.dequeuedByQueue.get(queueName) ?? 0;
    this.dequeuedByQueue.set(queueName, current + 1);
  }

  public recordWaitTime(queueName: string, waitTimeMs: number): void {
    const times = this.waitTimeByQueue.get(queueName) ?? [];
    times.push(waitTimeMs);
    this.waitTimeByQueue.set(queueName, times);
  }

  public recordFailed(queueName: string, reason: string): void {
    const current = this.failedByQueue.get(queueName) ?? 0;
    this.failedByQueue.set(queueName, current + 1);

    // Record in collector if exists
    const collector = this.queueCollectors.get(queueName);
    if (collector) {
      collector.recordFailed(reason);
    }
  }

  public deriveFromStats(stats: QueueStats): void {
    const totalActive = stats.waiting + stats.delayed + stats.active;
    this.recordDepth(stats.queueName, totalActive);

    const deadLetterFailed = stats.failed + stats.deadLetter;
    const currentFailed = this.failedByQueue.get(stats.queueName) ?? 0;
    if (deadLetterFailed > currentFailed) {
      this.failedByQueue.set(stats.queueName, deadLetterFailed);
    }
  }

  public getSnapshot(): QueueMetricsSnapshot {
    const timestamp = new Date().toISOString();
    const result: QueueMetricsSnapshot = {
      timestamp,
      queues: new Map(this.depthByQueue),
      enqueuedPerMinute: new Map(this.enqueuedByQueue),
      dequeuedPerMinute: new Map(this.dequeuedByQueue),
      averageWaitTimeMs: new Map(),
      p95WaitTimeMs: new Map(),
      failedJobs: new Map(this.failedByQueue),
      successRate: new Map(),
    };

    // Calculate average and p95 wait times per queue
    // Iterate over all queues that have wait times OR depth recorded
    const allQueueNames = new Set([...this.waitTimeByQueue.keys(), ...this.depthByQueue.keys()]);
    for (const queueName of allQueueNames) {
      const times = this.waitTimeByQueue.get(queueName) ?? [];
      if (times.length > 0) {
        const sum = times.reduce((s, t) => s + t, 0);
        result.averageWaitTimeMs.set(queueName, sum / times.length);

        const sorted = [...times].sort((a, b) => a - b);
        const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
        result.p95WaitTimeMs.set(queueName, sorted[p95Index] ?? sorted[sorted.length - 1]!);
      } else {
        result.averageWaitTimeMs.set(queueName, 0);
        result.p95WaitTimeMs.set(queueName, 0);
      }
    }

    // Calculate success rate per queue
    for (const [queueName, enqueued] of this.enqueuedByQueue) {
      const failed = this.failedByQueue.get(queueName) ?? 0;
      const dequeued = this.dequeuedByQueue.get(queueName) ?? 0;
      if (enqueued > 0) {
        result.successRate.set(queueName, (enqueued - failed) / enqueued);
      }
    }

    return result;
  }

  public getQueueMetrics(queueName: string): QueueMetrics | undefined {
    if (!this.depthByQueue.has(queueName)) {
      return undefined;
    }

    const depth = this.depthByQueue.get(queueName) ?? 0;
    const enqueued = this.enqueuedByQueue.get(queueName) ?? 0;
    const dequeued = this.dequeuedByQueue.get(queueName) ?? 0;
    const waitTimes = this.waitTimeByQueue.get(queueName) ?? [];
    const avgWaitTime = waitTimes.length > 0
      ? waitTimes.reduce((s, t) => s + t, 0) / waitTimes.length
      : 0;

    return {
      queueName,
      depth,
      enqueuedPerMinute: enqueued,
      dequeuedPerMinute: dequeued,
      averageWaitTimeMs: avgWaitTime,
    };
  }

  public getAllQueues(): string[] {
    return Array.from(this.depthByQueue.keys());
  }

  public getCollector(queueName: string): QueueMetricCollector {
    let collector = this.queueCollectors.get(queueName);
    if (!collector) {
      collector = new QueueMetricCollector(queueName);
      this.queueCollectors.set(queueName, collector);
    }
    return collector;
  }

  public reset(): void {
    this.queueCollectors.clear();
    this.depthByQueue.clear();
    this.enqueuedByQueue.clear();
    this.dequeuedByQueue.clear();
    this.waitTimeByQueue.clear();
    this.failedByQueue.clear();
    this.timestampsByQueue.clear();
  }
}
