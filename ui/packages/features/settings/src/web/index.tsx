import { useState, type ReactElement } from "react";
import { FeatureScaffold, KeyValueTable, ListCard, MetricGrid, ThreePaneLayout } from "@aa/ui-core";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useSettingsVm } from "../hooks";
import SettingsApiKeys from "../sub-pages/api-keys";
import SettingsNotifications from "../sub-pages/notifications";

export function SettingsWebView(): ReactElement {
  const vm = useSettingsVm();
  const [activeSection, setActiveSection] = useState("general");
  const featureCopy = translateFeatureCopy("settings");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Internal">
      <MetricGrid metrics={vm.metrics} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        {vm.sectionItems.map((section) => (
          <button key={section.id} onClick={() => setActiveSection(section.id)} type="button">
            {section.title}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <ThreePaneLayout
          left={<ListCard items={activeSection === "general" ? vm.leftItems : vm.sectionItems.map((item) => ({ title: item.title, description: item.description }))} />}
          center={vm.loading ? <p>{translateMessage("ui.settings.loading")}</p> : (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select onChange={(event) => vm.setDraftTheme(event.target.value as "light" | "dark" | "high-contrast")} value={vm.draftTheme}>
                  <option value="light">{translateMessage("ui.settings.theme.light")}</option>
                  <option value="dark">{translateMessage("ui.settings.theme.dark")}</option>
                  <option value="high-contrast">{translateMessage("ui.settings.theme.highContrast")}</option>
                </select>
                <select onChange={(event) => vm.setDraftLocale(event.target.value)} value={vm.draftLocale}>
                  {vm.localeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button onClick={vm.save} type="button">{translateMessage("ui.settings.save")}</button>
              </div>
              {activeSection === "general" ? <KeyValueTable rows={vm.centerRows} /> : null}
              {activeSection === "api-keys" ? <SettingsApiKeys /> : null}
              {activeSection === "notifications" ? <SettingsNotifications /> : null}
            </div>
          )}
          right={<ListCard items={vm.activityItems.length > 0 ? vm.activityItems : vm.rightItems} />}
        />
      </div>
      <p style={{ marginTop: 16 }}>{translateMessage("ui.settings.saveState")}: {vm.saveState}</p>
    </FeatureScaffold>
  );
}
