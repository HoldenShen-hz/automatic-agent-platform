import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createInspectMobileCards() {
    return [
        createMobileFeatureCard("Snapshot", "Current context and operator state"),
        createMobileFeatureCard("Tool Trace", "Recent tool executions"),
        createMobileFeatureCard("Evidence", "Timeline and artifacts"),
    ];
}
