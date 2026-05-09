import type { TranslationCatalog } from "../index";

export const zhCnCatalog: TranslationCatalog = {
  locale: "zh-CN",
  fallbackLocales: ["en-US"],
  messages: {
    "ui.app.title": "Automatic Agent Platform UI",
    "ui.planned": "规划中能力",
    "ui.implemented": "已接线能力",
    "ui.notifications.pending": "{count, plural, =0 {没有待处理项} one {# 条待处理项} other {# 条待处理项}}",
    "ui.workbench.filter.label": "筛选工作台条目",
    "ui.workbench.filter.placeholder": "筛选当前工作台项",
    "ui.workbench.empty": "暂无可操作项",
    "ui.workbench.activityLog": "操作日志",
    "ui.workbench.activityEmpty": "执行动作后会在这里记录最近轨迹。",
    "ui.settings.locale.label": "语言",
    "ui.settings.theme.label": "主题",
  },
};
