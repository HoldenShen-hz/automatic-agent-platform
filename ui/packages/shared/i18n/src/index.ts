import IntlMessageFormat from "intl-messageformat";

export interface TranslationCatalog {
  readonly locale: string;
  readonly messages: Readonly<Record<string, string>>;
  readonly fallbackLocales?: readonly string[];
}

export class TranslationService {
  private readonly catalogs = new Map<string, TranslationCatalog>();
  private currentLocale = "en-US";

  public register(catalog: TranslationCatalog): void {
    this.catalogs.set(catalog.locale, catalog);
  }

  public setLocale(locale: string): void {
    this.currentLocale = locale;
  }

  public getLocale(): string {
    return this.currentLocale;
  }

  public translate(
    key: string,
    locale = this.currentLocale,
    fallbackLocale = "en-US",
    values?: Readonly<Record<string, unknown>>,
  ): string {
    const chain = [locale];
    const catalog = this.catalogs.get(locale);
    if (catalog?.fallbackLocales != null) {
      chain.push(...catalog.fallbackLocales);
    }
    chain.push(fallbackLocale);
    for (const candidate of chain) {
      const resolved = this.catalogs.get(candidate);
      const message = resolved?.messages[key];
      if (message != null) {
        if (values == null || Object.keys(values).length === 0) {
          return message;
        }
        return new IntlMessageFormat(message, candidate).format(values) as string;
      }
    }
    return key;
  }

  public detectLocale(preferredLocales: readonly string[]): string {
    for (const locale of preferredLocales) {
      if (this.catalogs.has(locale)) {
        return locale;
      }
    }
    return this.currentLocale;
  }
}

export function createDefaultTranslationService(): TranslationService {
  const service = new TranslationService();
  service.register({
    locale: "zh-CN",
    fallbackLocales: ["en-US"],
    messages: {
      // App-level
      "ui.app.title": "Automatic Agent Platform UI",
      "ui.app.subtitle": "自动化智能体平台",
      "ui.app.version": "版本 {version}",
      "ui.app.loading": "加载中...",
      "ui.app.error": "错误",
      "ui.app.retry": "重试",
      "ui.app.cancel": "取消",
      "ui.app.confirm": "确认",
      "ui.app.save": "保存",
      "ui.app.delete": "删除",
      "ui.app.edit": "编辑",
      "ui.app.close": "关闭",
      "ui.app.search": "搜索",
      "ui.app.filter": "筛选",
      "ui.app.clear": "清除",
      "ui.app.export": "导出",
      "ui.app.import": "导入",
      "ui.app.refresh": "刷新",
      // Navigation
      "ui.nav.dashboard": "仪表板",
      "ui.nav.tasks": "任务",
      "ui.nav.workflows": "工作流",
      "ui.nav.executions": "执行记录",
      "ui.nav.monitoring": "监控",
      "ui.nav.settings": "设置",
      "ui.nav.help": "帮助",
      "ui.nav.profile": "个人中心",
      // Status labels
      "ui.planned": "规划中能力",
      "ui.implemented": "已接线能力",
      "ui.status.pending": "待处理",
      "ui.status.running": "运行中",
      "ui.status.completed": "已完成",
      "ui.status.failed": "失败",
      "ui.status.cancelled": "已取消",
      "ui.status.paused": "已暂停",
      "ui.status.blocked": "已阻塞",
      // Notifications
      "ui.notifications.pending": "{count, plural, =0 {没有待处理项} one {# 条待处理项} other {# 条待处理项}}",
      "ui.notifications.new": "新通知",
      "ui.notifications.all": "全部通知",
      "ui.notifications.markRead": "标记已读",
      "ui.notifications.clear": "清除通知",
      // Risk levels
      "ui.risk.low": "低风险",
      "ui.risk.medium": "中风险",
      "ui.risk.high": "高风险",
      "ui.risk.critical": "极危风险",
      // Autonomy levels
      "ui.autonomy.manual": "手动",
      "ui.autonomy.assisted": "辅助",
      "ui.autonomy.autonomous": "自主",
      "ui.autonomy.full": "完全自主",
      // Common actions
      "ui.action.create": "创建",
      "ui.action.update": "更新",
      "ui.action.view": "查看",
      "ui.action.delete": "删除",
      "ui.action.enable": "启用",
      "ui.action.disable": "禁用",
      "ui.action.start": "启动",
      "ui.action.stop": "停止",
      "ui.action.pause": "暂停",
      "ui.action.resume": "继续",
      "ui.action.submit": "提交",
      "ui.action.approve": "批准",
      "ui.action.reject": "拒绝",
      // Form labels
      "ui.form.name": "名称",
      "ui.form.description": "描述",
      "ui.form.status": "状态",
      "ui.form.type": "类型",
      "ui.form.priority": "优先级",
      "ui.form.owner": "负责人",
      "ui.form.created": "创建时间",
      "ui.form.updated": "更新时间",
      "ui.form.tags": "标签",
      // Error messages
      "ui.error.required": "此字段为必填项",
      "ui.error.invalid": "无效的值",
      "ui.error.network": "网络错误，请稍后重试",
      "ui.error.unauthorized": "未授权，请重新登录",
      "ui.error.forbidden": "无权限访问此资源",
      "ui.error.notFound": "未找到请求的资源",
      "ui.error.serverError": "服务器错误，请联系管理员",
      // Confirmation dialogs
      "ui.confirm.delete.title": "确认删除",
      "ui.confirm.delete.message": "此操作无法撤销。确定要继续吗？",
      "ui.confirm.unsaved.title": "有未保存的更改",
      "ui.confirm.unsaved.message": "确定要离开此页面吗？",
      // Empty states
      "ui.empty.tasks": "暂无任务",
      "ui.empty.workflows": "暂无工作流",
      "ui.empty.executions": "暂无执行记录",
      "ui.empty.results": "无结果",
      // Pagination
      "ui.pagination.page": "第 {current} 页，共 {total} 页",
      "ui.pagination.perPage": "每页 {size} 条",
      "ui.pagination.first": "首页",
      "ui.pagination.last": "末页",
      "ui.pagination.next": "下一页",
      "ui.pagination.prev": "上一页",
    },
  });
  service.register({
    locale: "en-US",
    messages: {
      // App-level
      "ui.app.title": "Automatic Agent Platform UI",
      "ui.app.subtitle": "Automatic Agent Platform",
      "ui.app.version": "Version {version}",
      "ui.app.loading": "Loading...",
      "ui.app.error": "Error",
      "ui.app.retry": "Retry",
      "ui.app.cancel": "Cancel",
      "ui.app.confirm": "Confirm",
      "ui.app.save": "Save",
      "ui.app.delete": "Delete",
      "ui.app.edit": "Edit",
      "ui.app.close": "Close",
      "ui.app.search": "Search",
      "ui.app.filter": "Filter",
      "ui.app.clear": "Clear",
      "ui.app.export": "Export",
      "ui.app.import": "Import",
      "ui.app.refresh": "Refresh",
      // Navigation
      "ui.nav.dashboard": "Dashboard",
      "ui.nav.tasks": "Tasks",
      "ui.nav.workflows": "Workflows",
      "ui.nav.executions": "Executions",
      "ui.nav.monitoring": "Monitoring",
      "ui.nav.settings": "Settings",
      "ui.nav.help": "Help",
      "ui.nav.profile": "Profile",
      // Status labels
      "ui.planned": "Planned capability",
      "ui.implemented": "Implemented capability",
      "ui.status.pending": "Pending",
      "ui.status.running": "Running",
      "ui.status.completed": "Completed",
      "ui.status.failed": "Failed",
      "ui.status.cancelled": "Cancelled",
      "ui.status.paused": "Paused",
      "ui.status.blocked": "Blocked",
      // Notifications
      "ui.notifications.pending": "{count, plural, =0 {No pending items} one {# pending item} other {# pending items}}",
      "ui.notifications.new": "New notifications",
      "ui.notifications.all": "All notifications",
      "ui.notifications.markRead": "Mark as read",
      "ui.notifications.clear": "Clear notifications",
      // Risk levels
      "ui.risk.low": "Low risk",
      "ui.risk.medium": "Medium risk",
      "ui.risk.high": "High risk",
      "ui.risk.critical": "Critical risk",
      // Autonomy levels
      "ui.autonomy.manual": "Manual",
      "ui.autonomy.assisted": "Assisted",
      "ui.autonomy.autonomous": "Autonomous",
      "ui.autonomy.full": "Full autonomy",
      // Common actions
      "ui.action.create": "Create",
      "ui.action.update": "Update",
      "ui.action.view": "View",
      "ui.action.delete": "Delete",
      "ui.action.enable": "Enable",
      "ui.action.disable": "Disable",
      "ui.action.start": "Start",
      "ui.action.stop": "Stop",
      "ui.action.pause": "Pause",
      "ui.action.resume": "Resume",
      "ui.action.submit": "Submit",
      "ui.action.approve": "Approve",
      "ui.action.reject": "Reject",
      // Form labels
      "ui.form.name": "Name",
      "ui.form.description": "Description",
      "ui.form.status": "Status",
      "ui.form.type": "Type",
      "ui.form.priority": "Priority",
      "ui.form.owner": "Owner",
      "ui.form.created": "Created",
      "ui.form.updated": "Updated",
      "ui.form.tags": "Tags",
      // Error messages
      "ui.error.required": "This field is required",
      "ui.error.invalid": "Invalid value",
      "ui.error.network": "Network error, please try again later",
      "ui.error.unauthorized": "Unauthorized, please re-login",
      "ui.error.forbidden": "Access denied to this resource",
      "ui.error.notFound": "Resource not found",
      "ui.error.serverError": "Server error, please contact administrator",
      // Confirmation dialogs
      "ui.confirm.delete.title": "Confirm deletion",
      "ui.confirm.delete.message": "This action cannot be undone. Are you sure you want to continue?",
      "ui.confirm.unsaved.title": "Unsaved changes",
      "ui.confirm.unsaved.message": "Are you sure you want to leave this page?",
      // Empty states
      "ui.empty.tasks": "No tasks",
      "ui.empty.workflows": "No workflows",
      "ui.empty.executions": "No executions",
      "ui.empty.results": "No results",
      // Pagination
      "ui.pagination.page": "Page {current} of {total}",
      "ui.pagination.perPage": "{size} per page",
      "ui.pagination.first": "First",
      "ui.pagination.last": "Last",
      "ui.pagination.next": "Next",
      "ui.pagination.prev": "Previous",
    },
  });
  service.setLocale("zh-CN");
  return service;
}
