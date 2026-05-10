import { EChartSurface, FeatureScaffold, MetricGrid, createPanelStyle, designTokens } from "@aa/ui-core";
import type { ReactElement } from "react";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useDashboardVm } from "../hooks";

export function DashboardWebView(): ReactElement {
  const vm = useDashboardVm();
  const featureCopy = translateFeatureCopy("dashboard");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Internal">
      {vm.loading ? <p>{translateMessage("ui.dashboard.loading")}</p> : (
        <>
          <MetricGrid metrics={vm.metrics} />
          <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
            {vm.panelGroups.map((group) => (
              <section key={group.id} style={createPanelStyle(designTokens.color.border)}>
                <header style={{ marginBottom: 12 }}>
                  <h3 style={{ color: designTokens.color.text, margin: 0 }}>{group.title}</h3>
                  <p style={{ color: designTokens.color.subtle, marginBottom: 0 }}>{group.description}</p>
                </header>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                  {group.panels.map((panel) => (
                    <article key={panel.id} style={createPanelStyle(designTokens.color.info)}>
                      <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{panel.title}</div>
                      <div style={{ color: designTokens.color.text, fontSize: 24, fontWeight: 700, marginTop: 8 }}>{panel.value}</div>
                      <p style={{ color: designTokens.color.subtle, marginBottom: 0 }}>{panel.description}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <EChartSurface title={translateMessage("ui.dashboard.trendTitle")} values={vm.trendValues} />
          </div>
        </>
      )}
    </FeatureScaffold>
  );
}
