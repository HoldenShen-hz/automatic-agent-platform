import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createAlertsMobileCards(incidents) {
    return incidents.slice(0, 3).map((incident) => createMobileFeatureCard(incident.title, `${incident.severity} · ${incident.createdAt}`, incident.severity));
}
