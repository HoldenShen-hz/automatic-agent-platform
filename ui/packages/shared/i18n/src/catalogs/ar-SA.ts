import type { TranslationCatalog } from "../index";

export const arSaCatalog: TranslationCatalog = {
  locale: "ar-SA",
  fallbackLocales: ["en-US"],
  messages: {
    "ui.app.title": "منصة الوكيل الآلي",
    "ui.planned": "قدرة مخطط لها",
    "ui.implemented": "قدرة مفعلة",
    "ui.notifications.pending": "{count, plural, =0 {لا توجد عناصر معلقة} one {عنصر واحد معلق} two {عنصران معلقان} few {# عناصر معلقة} many {# عنصرًا معلقًا} other {# عنصر معلق}}",
    "ui.workbench.filter.label": "تصفية عناصر مساحة العمل",
    "ui.workbench.filter.placeholder": "قم بتصفية عناصر مساحة العمل الحالية",
    "ui.workbench.empty": "لا توجد عناصر قابلة للتنفيذ",
    "ui.workbench.activityLog": "سجل النشاط",
    "ui.workbench.activityEmpty": "ستظهر الإجراءات الأخيرة هنا بعد التنفيذ.",
    "ui.settings.locale.label": "اللغة",
    "ui.settings.theme.label": "السمة",
  },
};
