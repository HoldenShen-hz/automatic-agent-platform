import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createIncidentsMobileCards(incidents) {
    return incidents.slice(0, 3).map((incident) => createMobileFeatureCard(incident.title, incident.summary, incident.severity));
}
