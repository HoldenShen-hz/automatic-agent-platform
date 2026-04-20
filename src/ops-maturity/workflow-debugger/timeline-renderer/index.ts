export interface TimelineFrame {
  readonly timestamp: string;
  readonly label: string;
}

export function renderWorkflowTimeline(frames: readonly TimelineFrame[]): string[] {
  return frames.map((item) => `${item.timestamp} ${item.label}`);
}
