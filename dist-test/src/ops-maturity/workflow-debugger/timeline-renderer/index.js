export function renderWorkflowTimeline(frames) {
    return frames.map((item) => {
        const status = item.status ? ` [${item.status}]` : "";
        const duration = item.durationMs != null ? ` (${item.durationMs}ms)` : "";
        return `${item.timestamp} ${item.label}${status}${duration}`;
    });
}
export function renderWorkflowTimelineMarkdown(title, frames) {
    return [`# ${title}`, "", ...renderWorkflowTimeline(frames).map((item) => `- ${item}`)].join("\n");
}
//# sourceMappingURL=index.js.map