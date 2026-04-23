import { FeatureScaffold, ListCard, createFeatureModule } from "@aa/ui-core";
import { useIncidentsQuery } from "@aa/shared-state";

export default createFeatureModule({
  id: "alerts",
  title: "Alerts",
  group: "Mission Control",
  path: "/mission-control/alerts",
  permission: "authenticated",
  status: "Implemented/Internal",
  summary: "Incident 和高优先级告警流。",
  render: () => {
    const incidents = useIncidentsQuery().data ?? [];
    return (
      <FeatureScaffold title="Alerts" summary="Incident 和高优先级告警流" status="Implemented/Internal">
        <ListCard
          items={incidents.map((incident) => ({
            title: `${incident.severity} · ${incident.title}`,
            description: `${incident.summary} · ${incident.createdAt}`,
          }))}
        />
      </FeatureScaffold>
    );
  },
});
