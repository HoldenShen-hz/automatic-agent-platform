/**
 * Unit tests for WorkflowTimelineRenderer
 *
 * @see src/ops-maturity/workflow-debugger/timeline-renderer/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { renderWorkflowTimeline, renderWorkflowTimelineMarkdown, type TimelineFrame } from "../../../../../src/ops-maturity/workflow-debugger/timeline-renderer/index.js";

test("renderWorkflowTimeline renders single frame with timestamp and label", () => {
  const frames: readonly TimelineFrame[] = [
    { timestamp: "2026-04-20T10:00:00.000Z", label: "Task started" },
  ];

  const result = renderWorkflowTimeline(frames);

  assert.deepEqual(result, ["2026-04-20T10:00:00.000Z Task started"]);
});

test("renderWorkflowTimeline includes optional status in output", () => {
  const frames: readonly TimelineFrame[] = [
    { timestamp: "2026-04-20T10:00:00.000Z", label: "Building", status: "running" },
  ];

  const result = renderWorkflowTimeline(frames);

  assert.ok(result[0]!.includes("[running]"));
});

test("renderWorkflowTimeline includes optional durationMs in output", () => {
  const frames: readonly TimelineFrame[] = [
    { timestamp: "2026-04-20T10:00:00.000Z", label: "Build step", durationMs: 1500 },
  ];

  const result = renderWorkflowTimeline(frames);

  assert.ok(result[0]!.includes("(1500ms)"));
});

test("renderWorkflowTimeline renders multiple frames in order", () => {
  const frames: readonly TimelineFrame[] = [
    { timestamp: "2026-04-20T10:00:00.000Z", label: "Step 1" },
    { timestamp: "2026-04-20T10:01:00.000Z", label: "Step 2" },
    { timestamp: "2026-04-20T10:02:00.000Z", label: "Step 3" },
  ];

  const result = renderWorkflowTimeline(frames);

  assert.equal(result.length, 3);
  assert.ok(result[0]!.includes("Step 1"));
  assert.ok(result[1]!.includes("Step 2"));
  assert.ok(result[2]!.includes("Step 3"));
});

test("renderWorkflowTimeline handles empty frames array", () => {
  const result = renderWorkflowTimeline([]);
  assert.deepEqual(result, []);
});

test("renderWorkflowTimeline combines status and duration when both present", () => {
  const frames: readonly TimelineFrame[] = [
    {
      timestamp: "2026-04-20T10:00:00.000Z",
      label: "Deploy",
      status: "completed",
      durationMs: 3000,
    },
  ];

  const result = renderWorkflowTimeline(frames);

  assert.ok(result[0]!.includes("[completed]"));
  assert.ok(result[0]!.includes("(3000ms)"));
});

test("renderWorkflowTimelineMarkdown renders title and bullet list", () => {
  const frames: readonly TimelineFrame[] = [
    { timestamp: "2026-04-20T10:00:00.000Z", label: "Step 1" },
  ];

  const result = renderWorkflowTimelineMarkdown("Test Workflow", frames);

  assert.ok(result.startsWith("# Test Workflow"));
  assert.ok(result.includes("- 2026-04-20T10:00:00.000Z Step 1"));
});

test("renderWorkflowTimelineMarkdown handles empty frames", () => {
  const result = renderWorkflowTimelineMarkdown("Empty Workflow", []);
  assert.ok(result.startsWith("# Empty Workflow"));
  // With empty frames, no bullet items are rendered
  const lines = result.split("\n");
  assert.equal(lines.filter((l) => l.startsWith("- ")).length, 0);
});

test("renderWorkflowTimelineMarkdown includes multiple items", () => {
  const frames: readonly TimelineFrame[] = [
    { timestamp: "2026-04-20T10:00:00.000Z", label: "Start" },
    { timestamp: "2026-04-20T10:01:00.000Z", label: "Middle" },
    { timestamp: "2026-04-20T10:02:00.000Z", label: "End" },
  ];

  const result = renderWorkflowTimelineMarkdown("Multi-Step", frames);

  assert.ok(result.includes("- 2026-04-20T10:00:00.000Z Start"));
  assert.ok(result.includes("- 2026-04-20T10:01:00.000Z Middle"));
  assert.ok(result.includes("- 2026-04-20T10:02:00.000Z End"));
});