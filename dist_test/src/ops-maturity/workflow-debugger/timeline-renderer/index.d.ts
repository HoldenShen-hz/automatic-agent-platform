export interface TimelineFrame {
    readonly timestamp: string;
    readonly label: string;
}
export declare function renderWorkflowTimeline(frames: readonly TimelineFrame[]): string[];
