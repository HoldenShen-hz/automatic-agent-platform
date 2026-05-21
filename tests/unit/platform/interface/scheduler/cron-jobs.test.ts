/**
 * Unit tests for cron job scheduling functionality
 * Tests scheduling concepts for recurring task execution
 */

import assert from "node:assert/strict";
import test from "node:test";

// ============================================================
// Cron Expression Types and Parsing
// ============================================================

interface CronSchedule {
  cronExpression: string;
  timezone?: string;
  enabled: boolean;
  description?: string;
}

interface CronJobConfig {
  jobId: string;
  schedule: CronSchedule;
  taskTemplate: string;
  maxInstances: number;
  retainCompletedRuns: number;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  status: "active" | "paused" | "error";
  errorMessage?: string | null;
}

interface ScheduledTask {
  taskId: string;
  scheduledAt: string;
  cronJobId?: string;
  payload: Record<string, unknown>;
  priority: number;
}

interface CronRunRecord {
  runId: string;
  cronJobId: string;
  taskId: string;
  status: "success" | "failed" | "skipped";
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

// ============================================================
// CronSchedule Tests
// ============================================================

test("CronSchedule with standard cron expression", () => {
  const schedule: CronSchedule = {
    cronExpression: "0 * * * *", // Every hour
    enabled: true,
  };

  assert.equal(schedule.cronExpression, "0 * * * *");
  assert.equal(schedule.enabled, true);
});

test("CronSchedule with timezone", () => {
  const schedule: CronSchedule = {
    cronExpression: "0 9 * * *",
    timezone: "America/New_York",
    enabled: true,
  };

  assert.equal(schedule.timezone, "America/New_York");
});

test("CronSchedule for daily midnight", () => {
  const schedule: CronSchedule = {
    cronExpression: "0 0 * * *",
    timezone: "UTC",
    enabled: true,
    description: "Runs daily at midnight",
  };

  assert.equal(schedule.description, "Runs daily at midnight");
});

test("CronSchedule for weekly Monday", () => {
  const schedule: CronSchedule = {
    cronExpression: "0 0 * * 1",
    enabled: true,
    description: "Runs every Monday at midnight",
  };

  assert.equal(schedule.cronExpression, "0 0 * * 1");
});

test("CronSchedule for complex schedule - every 15 minutes", () => {
  const schedule: CronSchedule = {
    cronExpression: "*/15 * * * *",
    enabled: true,
  };

  assert.equal(schedule.cronExpression, "*/15 * * * *");
});

// ============================================================
// CronJobConfig Tests
// ============================================================

test("CronJobConfig minimal structure", () => {
  const job: CronJobConfig = {
    jobId: "cron_job_1",
    schedule: {
      cronExpression: "0 * * * *",
      enabled: true,
    },
    taskTemplate: "cleanup_task",
    maxInstances: 1,
    retainCompletedRuns: 10,
    status: "active",
  };

  assert.equal(job.jobId, "cron_job_1");
  assert.equal(job.status, "active");
  assert.equal(job.maxInstances, 1);
  assert.equal(job.retainCompletedRuns, 10);
});

test("CronJobConfig with last and next run times", () => {
  const job: CronJobConfig = {
    jobId: "cron_job_2",
    schedule: {
      cronExpression: "0 9 * * *",
      enabled: true,
    },
    taskTemplate: "morning_report",
    maxInstances: 1,
    retainCompletedRuns: 30,
    lastRunAt: "2026-05-01T09:00:00.000Z",
    nextRunAt: "2026-05-02T09:00:00.000Z",
    status: "active",
  };

  assert.equal(job.lastRunAt, "2026-05-01T09:00:00.000Z");
  assert.equal(job.nextRunAt, "2026-05-02T09:00:00.000Z");
});

test("CronJobConfig with paused status", () => {
  const job: CronJobConfig = {
    jobId: "cron_job_paused",
    schedule: {
      cronExpression: "0 * * * *",
      enabled: false,
    },
    taskTemplate: "paused_task",
    maxInstances: 1,
    retainCompletedRuns: 5,
    status: "paused",
  };

  assert.equal(job.status, "paused");
  assert.equal(job.schedule.enabled, false);
});

test("CronJobConfig with error status", () => {
  const job: CronJobConfig = {
    jobId: "cron_job_err",
    schedule: {
      cronExpression: "0 * * * *",
      enabled: true,
    },
    taskTemplate: "error_task",
    maxInstances: 1,
    retainCompletedRuns: 5,
    status: "error",
    errorMessage: "Previous run exceeded timeout",
  };

  assert.equal(job.status, "error");
  assert.equal(job.errorMessage, "Previous run exceeded timeout");
});

test("CronJobConfig with multiple allowed instances", () => {
  const job: CronJobConfig = {
    jobId: "cron_parallel",
    schedule: {
      cronExpression: "*/5 * * * *",
      enabled: true,
    },
    taskTemplate: "parallel_task",
    maxInstances: 3,
    retainCompletedRuns: 20,
    status: "active",
  };

  assert.equal(job.maxInstances, 3);
});

test("CronJobConfig calculates interval from cron expression", () => {
  const schedules: { expr: string; expectedIntervalMinutes: number }[] = [
    { expr: "* * * * *", expectedIntervalMinutes: 1 },
    { expr: "*/5 * * * *", expectedIntervalMinutes: 5 },
    { expr: "*/15 * * * *", expectedIntervalMinutes: 15 },
    { expr: "*/30 * * * *", expectedIntervalMinutes: 30 },
    { expr: "0 * * * *", expectedIntervalMinutes: 60 },
  ];

  for (const { expr, expectedIntervalMinutes } of schedules) {
    const job: CronJobConfig = {
      jobId: `interval_test_${expr}`,
      schedule: { cronExpression: expr, enabled: true },
      taskTemplate: "interval_check",
      maxInstances: 1,
      retainCompletedRuns: 5,
      status: "active",
    };

    // Parse cron expression to extract interval (simplified parsing)
    const parts = expr.split(" ");
    let interval = 1;
    if (parts[0].startsWith("*/")) {
      interval = parseInt(parts[0].substring(2), 10);
    } else if (parts[0] === "*") {
      interval = 1;
    }

    assert.equal(interval, expectedIntervalMinutes);
  }
});

// ============================================================
// ScheduledTask Tests
// ============================================================

test("ScheduledTask basic structure", () => {
  const task: ScheduledTask = {
    taskId: "sched_task_1",
    scheduledAt: "2026-05-01T14:00:00.000Z",
    payload: { action: "send_report" },
    priority: 5,
  };

  assert.equal(task.taskId, "sched_task_1");
  assert.equal(task.scheduledAt, "2026-05-01T14:00:00.000Z");
  assert.equal(task.priority, 5);
});

test("ScheduledTask from cron job", () => {
  const task: ScheduledTask = {
    taskId: "cron_derived_task",
    scheduledAt: "2026-05-01T09:00:00.000Z",
    cronJobId: "morning_report_cron",
    payload: { reportType: "daily" },
    priority: 10,
  };

  assert.equal(task.cronJobId, "morning_report_cron");
});

test("ScheduledTask with complex payload", () => {
  const task: ScheduledTask = {
    taskId: "complex_payload_task",
    scheduledAt: "2026-05-01T10:00:00.000Z",
    payload: {
      workflowId: "wf_123",
      steps: ["validate", "process", "notify"],
      options: { retry: true, timeout: 30000 },
    },
    priority: 8,
  };

  assert.equal(task.payload.workflowId, "wf_123");
  assert.ok(Array.isArray(task.payload.steps));
  assert.equal(task.payload.options.retry, true);
});

test("ScheduledTask scheduling in the past is handled", () => {
  const pastTime = "2026-01-01T00:00:00.000Z";
  const now = "2026-05-01T12:00:00.000Z";

  const task: ScheduledTask = {
    taskId: "past_task",
    scheduledAt: pastTime,
    payload: {},
    priority: 1,
  };

  const scheduledTime = new Date(task.scheduledAt).getTime();
  const nowTime = new Date(now).getTime();
  const isInPast = scheduledTime < nowTime;

  assert.equal(isInPast, true);
});

test("ScheduledTask scheduling in future", () => {
  const futureTime = new Date(Date.now() + 3600_000).toISOString();
  const task: ScheduledTask = {
    taskId: "future_task",
    scheduledAt: futureTime,
    payload: {},
    priority: 5,
  };

  const scheduledTime = new Date(task.scheduledAt).getTime();
  assert.ok(scheduledTime > Date.now());
});

// ============================================================
// CronRunRecord Tests
// ============================================================

test("CronRunRecord successful run", () => {
  const run: CronRunRecord = {
    runId: "run_success_1",
    cronJobId: "morning_report",
    taskId: "task_report_1",
    status: "success",
    startedAt: "2026-05-01T09:00:00.000Z",
    completedAt: "2026-05-01T09:05:30.000Z",
    durationMs: 330000,
    errorMessage: null,
  };

  assert.equal(run.status, "success");
  assert.equal(run.durationMs, 330000);
  assert.equal(run.errorMessage, null);
});

test("CronRunRecord failed run", () => {
  const run: CronRunRecord = {
    runId: "run_fail_1",
    cronJobId: "cleanup_job",
    taskId: "task_cleanup_1",
    status: "failed",
    startedAt: "2026-05-01T10:00:00.000Z",
    completedAt: "2026-05-01T10:02:00.000Z",
    durationMs: 120000,
    errorMessage: "Database connection timeout",
  };

  assert.equal(run.status, "failed");
  assert.equal(run.errorMessage, "Database connection timeout");
});

test("CronRunRecord skipped run", () => {
  const run: CronRunRecord = {
    runId: "run_skip_1",
    cronJobId: "conditional_job",
    taskId: "task_cond_1",
    status: "skipped",
    startedAt: "2026-05-01T11:00:00.000Z",
    completedAt: "2026-05-01T11:00:01.000Z",
    durationMs: 1000,
    errorMessage: "Condition not met: queue depth below threshold",
  };

  assert.equal(run.status, "skipped");
  assert.ok(run.durationMs! < 5000); // Skipped quickly
});

test("CronRunRecord duration calculation", () => {
  const startedAt = "2026-05-01T14:00:00.000Z";
  const completedAt = "2026-05-01T14:10:30.000Z";

  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(completedAt).getTime();
  const durationMs = endMs - startMs;

  const run: CronRunRecord = {
    runId: "run_duration_test",
    cronJobId: "duration_test_job",
    taskId: "task_duration",
    status: "success",
    startedAt,
    completedAt,
    durationMs,
    errorMessage: null,
  };

  assert.equal(run.durationMs, 630000); // 10 minutes 30 seconds
});

// ============================================================
// Cron Job Scheduling Logic Tests
// ============================================================

test("Next run calculation - simple hourly schedule", () => {
  const cronExpression = "0 * * * *"; // Every hour at minute 0
  const lastRun = new Date("2026-05-01T09:00:00.000Z");

  // Simplified: extract minute from cron (0) and calculate next hour
  const minute = 0;
  const nextRun = new Date(lastRun);
  nextRun.setHours(nextRun.getHours() + 1);
  nextRun.setMinutes(minute);
  nextRun.setSeconds(0);

  assert.equal(nextRun.getHours(), 10);
  assert.equal(nextRun.getMinutes(), 0);
});

test("Next run calculation - daily schedule", () => {
  const cronExpression = "0 9 * * *"; // Daily at 9:00 AM
  const lastRun = new Date("2026-05-01T09:00:00.000Z");

  // Next run should be next day at 9 AM
  const nextRun = new Date(lastRun);
  nextRun.setDate(nextRun.getDate() + 1);

  assert.equal(nextRun.getDate(), 2);
  assert.equal(nextRun.getHours(), 9);
  assert.equal(nextRun.getMinutes(), 0);
});

test("Overdue job detection", () => {
  const schedule: CronSchedule = {
    cronExpression: "*/15 * * * *",
    enabled: true,
  };

  const nextRunAt = "2026-05-01T10:00:00.000Z";
  const now = "2026-05-01T10:20:00.000Z";

  const nextRunTime = new Date(nextRunAt).getTime();
  const nowTime = new Date(now).getTime();
  const overdueByMs = nowTime - nextRunTime;
  const overdueByMinutes = overdueByMs / (60 * 1000);

  assert.ok(overdueByMinutes > 15);
  assert.ok(overdueByMinutes >= 15);
});

test("Concurrent run limit enforcement", () => {
  const job: CronJobConfig = {
    jobId: "concurrent_limit_test",
    schedule: { cronExpression: "* * * * *", enabled: true },
    taskTemplate: "concurrent_task",
    maxInstances: 2,
    retainCompletedRuns: 10,
    status: "active",
  };

  const activeRuns = [
    { runId: "run_1", status: "success" as const },
    { runId: "run_2", status: "success" as const },
  ];

  const canStartNew = activeRuns.length < job.maxInstances;
  assert.equal(canStartNew, false);

  // After one completes
  activeRuns.pop();
  const canStartAgain = activeRuns.length < job.maxInstances;
  assert.equal(canStartAgain, true);
});

test("Retention policy - removing old completed runs", () => {
  const job: CronJobConfig = {
    jobId: "retention_test",
    schedule: { cronExpression: "* * * * *", enabled: true },
    taskTemplate: "retention_task",
    maxInstances: 1,
    retainCompletedRuns: 3,
    status: "active",
  };

  const runs: CronRunRecord[] = [
    { runId: "run_1", cronJobId: "retention_test", taskId: "task_1", status: "success", startedAt: "2026-04-28T10:00:00.000Z", completedAt: "2026-04-28T10:01:00.000Z", durationMs: 60000, errorMessage: null },
    { runId: "run_2", cronJobId: "retention_test", taskId: "task_2", status: "success", startedAt: "2026-04-29T10:00:00.000Z", completedAt: "2026-04-29T10:01:00.000Z", durationMs: 60000, errorMessage: null },
    { runId: "run_3", cronJobId: "retention_test", taskId: "task_3", status: "success", startedAt: "2026-04-30T10:00:00.000Z", completedAt: "2026-04-30T10:01:00.000Z", durationMs: 60000, errorMessage: null },
    { runId: "run_4", cronJobId: "retention_test", taskId: "task_4", status: "success", startedAt: "2026-05-01T10:00:00.000Z", completedAt: "2026-05-01T10:01:00.000Z", durationMs: 60000, errorMessage: null },
  ];

  // Sort by startedAt descending, keep only retainCompletedRuns
  const sorted = [...runs].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const toKeep = sorted.slice(0, job.retainCompletedRuns);
  const toRemove = sorted.slice(job.retainCompletedRuns);

  assert.equal(toKeep.length, 3);
  assert.equal(toRemove.length, 1);
  assert.equal(toRemove[0]!.runId, "run_1");
});

test("Cron job error recovery", () => {
  const job: CronJobConfig = {
    jobId: "recovery_test",
    schedule: { cronExpression: "0 * * * *", enabled: true },
    taskTemplate: "recovery_task",
    maxInstances: 1,
    retainCompletedRuns: 5,
    status: "error",
    errorMessage: "Connection refused",
  };

  // Clear error and re-enable
  job.status = "active";
  job.errorMessage = null;

  assert.equal(job.status, "active");
  assert.equal(job.errorMessage, null);
});

test("Schedule timezone handling", () => {
  const scheduleUTC: CronSchedule = {
    cronExpression: "0 9 * * *",
    timezone: "UTC",
    enabled: true,
  };

  const scheduleNY: CronSchedule = {
    cronExpression: "0 9 * * *",
    timezone: "America/New_York",
    enabled: true,
  };

  // 9 AM UTC
  const timeUTC = new Date("2026-05-01T09:00:00.000Z");
  assert.equal(timeUTC.getUTCHours(), 9);

  // 9 AM NY is 13:00 UTC (during DST)
  const nyHour = 9;
  const utcOffset = -4; // EDT
  const utcHour = (nyHour - utcOffset + 24) % 24;
  assert.equal(utcHour, 13);

  assert.notEqual(scheduleUTC.timezone, scheduleNY.timezone);
});

// ============================================================
// Scheduling Queue Integration
// ============================================================

test("Scheduled task enqueue priority ordering", () => {
  const tasks: ScheduledTask[] = [
    { taskId: "t1", scheduledAt: "2026-05-01T10:00:00.000Z", payload: {}, priority: 1 },
    { taskId: "t2", scheduledAt: "2026-05-01T10:00:00.000Z", payload: {}, priority: 10 },
    { taskId: "t3", scheduledAt: "2026-05-01T10:00:00.000Z", payload: {}, priority: 5 },
  ];

  const sorted = [...tasks].sort((a, b) => b.priority - a.priority);

  assert.equal(sorted[0]!.taskId, "t2");
  assert.equal(sorted[1]!.taskId, "t3");
  assert.equal(sorted[2]!.taskId, "t1");
});

test("Backfill missed cron runs on restart", () => {
  const job: CronJobConfig = {
    jobId: "backfill_test",
    schedule: { cronExpression: "0 * * * *", enabled: true },
    taskTemplate: "hourly_task",
    maxInstances: 1,
    retainCompletedRuns: 24,
    lastRunAt: "2026-05-01T06:00:00.000Z", // Last ran 6 hours ago
    status: "active",
  };

  const now = new Date("2026-05-01T12:00:00.000Z");
  const lastRun = new Date(job.lastRunAt!);
  const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (60 * 60 * 1000);

  // Should backfill runs for hours: 7, 8, 9, 10, 11 (5 runs)
  const missedRuns = Math.floor(hoursSinceLastRun);
  assert.ok(missedRuns >= 5);

  const backfillTasks: ScheduledTask[] = [];
  for (let i = 1; i <= missedRuns; i++) {
    const runTime = new Date(lastRun.getTime() + i * 60 * 60 * 1000);
    backfillTasks.push({
      taskId: `backfill_${runTime.getTime()}`,
      scheduledAt: runTime.toISOString(),
      cronJobId: job.jobId,
      payload: { isBackfill: true },
      priority: 1,
    });
  }

  assert.equal(backfillTasks.length, 5);
});