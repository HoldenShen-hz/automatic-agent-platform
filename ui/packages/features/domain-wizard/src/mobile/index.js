import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createDomainWizardMobileCards(domains) {
    return domains.slice(0, 3).map((domain) => createMobileFeatureCard(domain.displayName, `owner ${domain.owner}`));
}
