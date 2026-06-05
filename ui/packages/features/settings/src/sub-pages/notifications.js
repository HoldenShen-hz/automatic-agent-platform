import { jsx, jsxs } from "react/jsx-runtime";
import { translateMessage } from "@aa/shared-i18n";
function SettingsNotifications() {
  return /* @__PURE__ */ jsxs("section", { children: [
    /* @__PURE__ */ jsx("h3", { children: translateMessage("ui.settings.section.notifications") }),
    /* @__PURE__ */ jsx("p", { children: translateMessage("ui.settings.notifications.body") })
  ] });
}
export {
  SettingsNotifications as default
};
