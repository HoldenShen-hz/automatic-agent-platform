export interface TimelineFrame {
  readonly timestamp: string;
  readonly label: string;
  readonly status?: "queued" | "running" | "completed" | "failed";
  readonly durationMs?: number;
}

export function renderWorkflowTimeline(frames: readonly TimelineFrame[]): string[] {
  return frames.map((item) => {
    const status = item.status ? ` [${item.status}]` : "";
    const duration = item.durationMs != null ? ` (${item.durationMs}ms)` : "";
    return `${item.timestamp} ${item.label}${status}${duration}`;
  });
}

export function renderWorkflowTimelineMarkdown(title: string, frames: readonly TimelineFrame[]): string {
  return [`# ${title}`, "", ...renderWorkflowTimeline(frames).map((item) => `- ${item}`)].join("\n");
}
