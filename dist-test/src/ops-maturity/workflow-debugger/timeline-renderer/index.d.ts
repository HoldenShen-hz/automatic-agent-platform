export interface TimelineFrame {
    readonly timestamp: string;
    readonly label: string;
    readonly status?: "queued" | "running" | "completed" | "failed";
    readonly durationMs?: number;
}
export declare function renderWorkflowTimeline(frames: readonly TimelineFrame[]): string[];
export declare function renderWorkflowTimelineMarkdown(title: string, frames: readonly TimelineFrame[]): string;
