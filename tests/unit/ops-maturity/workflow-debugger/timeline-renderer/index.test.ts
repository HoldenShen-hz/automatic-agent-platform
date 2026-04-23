/**
 * Unit tests for Timeline Renderer
 *
 * @see src/ops-maturity/workflow-debugger/timeline-renderer/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  renderWorkflowTimeline,
  renderWorkflowTimelineMarkdown,
  type TimelineFrame,
} from "../../../../../src/ops-maturity/workflow-debugger/timeline-renderer/index.js";

test.describe("TimelineRenderer", () => {
  test.describe("renderWorkflowTimeline", () => {
    test("renders timeline frames with status and duration", () => {
      const frames: readonly TimelineFrame[] = [
        { timestamp: "2026-04-22T10:00:00Z", label: "init", status: "completed", durationMs: 100 },
        { timestamp: "2026-04-22T10:00:01Z", label: "deploy", status: "running" },
      ];

      const result = renderWorkflowTimeline(frames);

      assert.equal(result[0], "2026-04-22T10:00:00Z init [completed] (100ms)");
      assert.equal(result[1], "2026-04-22T10:00:01Z deploy [running]");
    });

    test("renders timeline frames without optional fields", () => {
      const frames: readonly TimelineFrame[] = [
        { timestamp: "2026-04-22T10:00:00Z", label: "init" },
      ];

      const result = renderWorkflowTimeline(frames);

      assert.equal(result[0], "2026-04-22T10:00:00Z init");
    });

    test("returns empty array for empty frames", () => {
      const frames: readonly TimelineFrame[] = [];

      const result = renderWorkflowTimeline(frames);

      assert.deepEqual(result, []);
    });

    test("handles all status types", () => {
      const frames: readonly TimelineFrame[] = [
        { timestamp: "2026-04-22T10:00:00Z", label: "queued-step", status: "queued" },
        { timestamp: "2026-04-22T10:00:01Z", label: "running-step", status: "running" },
        { timestamp: "2026-04-22T10:00:02Z", label: "completed-step", status: "completed" },
        { timestamp: "2026-04-22T10:00:03Z", label: "failed-step", status: "failed" },
      ];

      const result = renderWorkflowTimeline(frames);

      assert.equal(result[0], "2026-04-22T10:00:00Z queued-step [queued]");
      assert.equal(result[1], "2026-04-22T10:00:01Z running-step [running]");
      assert.equal(result[2], "2026-04-22T10:00:02Z completed-step [completed]");
      assert.equal(result[3], "2026-04-22T10:00:03Z failed-step [failed]");
    });
  });

  test.describe("renderWorkflowTimelineMarkdown", () => {
    test("renders timeline as markdown with title", () => {
      const frames: readonly TimelineFrame[] = [
        { timestamp: "2026-04-22T10:00:00Z", label: "init", status: "completed" },
      ];

      const result = renderWorkflowTimelineMarkdown("Deploy Pipeline", frames);

      assert.equal(result, "# Deploy Pipeline\n\n- 2026-04-22T10:00:00Z init [completed]");
    });

    test("renders empty markdown when no frames", () => {
      const frames: readonly TimelineFrame[] = [];

      const result = renderWorkflowTimelineMarkdown("Empty Pipeline", frames);

      assert.equal(result, "# Empty Pipeline\n");
    });

    test("renders multiple frames as markdown list", () => {
      const frames: readonly TimelineFrame[] = [
        { timestamp: "2026-04-22T10:00:00Z", label: "init", status: "completed", durationMs: 50 },
        { timestamp: "2026-04-22T10:00:01Z", label: "deploy", status: "running" },
      ];

      const result = renderWorkflowTimelineMarkdown("Deploy", frames);

      const lines = result.split("\n");
      assert.equal(lines[0], "# Deploy");
      assert.equal(lines[1], "");
      assert.equal(lines[2], "- 2026-04-22T10:00:00Z init [completed] (50ms)");
      assert.equal(lines[3], "- 2026-04-22T10:00:01Z deploy [running]");
    });
  });
});
