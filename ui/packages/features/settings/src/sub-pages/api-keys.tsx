import type { ReactElement } from "react";
import { translateMessage } from "@aa/shared-i18n";

export default function SettingsApiKeys(): ReactElement {
  return (
    <section>
      <h3>{translateMessage("ui.settings.section.apiKeys")}</h3>
      <p>{translateMessage("ui.settings.apiKeys.body")}</p>
    </section>
  );
}
