import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createAuditMobileCards() {
    return [
        createMobileFeatureCard("Timeline", "Review changes across config and approval"),
        createMobileFeatureCard("Evidence", "Export audit evidence bundles"),
        createMobileFeatureCard("Actor Trace", "Follow user and agent actions"),
    ];
}
