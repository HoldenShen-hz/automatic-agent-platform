import { jsx, jsxs } from "react/jsx-runtime";
import { translateMessage } from "@aa/shared-i18n";
function SettingsApiKeys() {
  return /* @__PURE__ */ jsxs("section", { children: [
    /* @__PURE__ */ jsx("h3", { children: translateMessage("ui.settings.section.apiKeys") }),
    /* @__PURE__ */ jsx("p", { children: translateMessage("ui.settings.apiKeys.body") })
  ] });
}
export {
  SettingsApiKeys as default
};
