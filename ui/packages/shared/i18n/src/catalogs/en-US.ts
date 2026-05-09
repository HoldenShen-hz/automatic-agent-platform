import type { TranslationCatalog } from "../index";

export const enUsCatalog: TranslationCatalog = {
  locale: "en-US",
  messages: {
    "ui.app.title": "Automatic Agent Platform UI",
    "ui.planned": "Planned capability",
    "ui.implemented": "Implemented capability",
    "ui.notifications.pending": "{count, plural, =0 {No pending items} one {# pending item} other {# pending items}}",
    "ui.workbench.filter.label": "Filter workbench items",
    "ui.workbench.filter.placeholder": "Filter current workbench items",
    "ui.workbench.empty": "No actionable items available",
    "ui.workbench.activityLog": "Activity log",
    "ui.workbench.activityEmpty": "Recent actions will appear here after execution.",
    "ui.settings.locale.label": "Locale",
    "ui.settings.theme.label": "Theme",
  },
};
