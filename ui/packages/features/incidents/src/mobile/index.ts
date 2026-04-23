import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { IncidentDTO } from "@aa/shared-types";

export function createIncidentsMobileCards(incidents: readonly IncidentDTO[]) {
  return incidents.slice(0, 3).map((incident) => createMobileFeatureCard(
    incident.title,
    incident.summary,
    incident.severity,
  ));
}
