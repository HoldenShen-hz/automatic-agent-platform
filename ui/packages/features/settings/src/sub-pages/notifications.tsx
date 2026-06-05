import type { ReactElement } from "react";
import { translateMessage } from "@aa/shared-i18n";

export default function SettingsNotifications(): ReactElement {
  return (
    <section>
      <h3>{translateMessage("ui.settings.section.notifications")}</h3>
      <p>{translateMessage("ui.settings.notifications.body")}</p>
    </section>
  );
}
