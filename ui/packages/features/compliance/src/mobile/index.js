import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createComplianceMobileCards() {
    return [
        createMobileFeatureCard("Standards", "Backend policy registry coverage"),
        createMobileFeatureCard("Audit Events", "Recent governance activity feed"),
        createMobileFeatureCard("Exception Approval", "Reviewed exception approval ratio"),
    ];
}
