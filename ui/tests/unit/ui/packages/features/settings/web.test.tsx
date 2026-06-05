// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  setDraftTheme: vi.fn(),
  setDraftLocale: vi.fn(),
}));

vi.mock("../../../../../../packages/features/settings/src/hooks", () => ({
  useSettingsVm: () => ({
    metrics: [{ label: "角色", value: 3 }],
    leftItems: [{ title: "用户偏好", description: "语言 / 主题 / 仪表板布局" }],
    centerRows: [{ key: "语言", value: "zh-CN" }],
    rightItems: [{ title: "minimax/minimax-m2.7", description: "coding · budget $12" }],
    loading: false,
    draftTheme: "dark",
    draftLocale: "zh-CN",
    saveState: "idle",
    activityItems: [],
    pendingOperations: 0,
    localeOptions: [{ value: "zh-CN", label: "简体中文" }],
    sectionItems: [
      { id: "general", title: "通用", description: "个人资料、语言、主题与仪表板布局" },
      { id: "api-keys", title: "API 密钥", description: "管理访问令牌和轮换窗口" },
      { id: "notifications", title: "通知", description: "邮件、推送和站内通知策略" },
    ],
    setDraftTheme: mocks.setDraftTheme,
    setDraftLocale: mocks.setDraftLocale,
    save: mocks.save,
  }),
}));

vi.mock("@aa/ui-core", () => ({
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Inline: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  KeyValueTable: ({ rows }: { rows: Array<{ key: string; value: string }> }) => (
    <div>{rows.map((row) => <div key={row.key}>{`${row.key}:${row.value}`}</div>)}</div>
  ),
  ListCard: ({ items }: { items: Array<{ title: string; description: string }> }) => (
    <div>{items.map((item) => <div key={`${item.title}-${item.description}`}>{item.title}</div>)}</div>
  ),
  MetricGrid: ({ metrics }: { metrics: Array<{ label: string; value: string | number }> }) => (
    <div>{metrics.map((metric) => <div key={metric.label}>{`${metric.label}:${metric.value}`}</div>)}</div>
  ),
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ThreePaneLayout: ({ left, center, right }: { left: React.ReactNode; center: React.ReactNode; right: React.ReactNode }) => (
    <div>
      <div>{left}</div>
      <div>{center}</div>
      <div>{right}</div>
    </div>
  ),
}));

import { SettingsWebView } from "../../../../../../packages/features/settings/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SettingsWebView", () => {
  it("keeps save controls only on the general section", () => {
    render(<SettingsWebView />);

    expect(screen.getByRole("button", { name: "保存设置" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "API 密钥" }));

    expect(screen.queryByRole("button", { name: "保存设置" })).toBeNull();
    expect(screen.getByText("契约边界")).toBeInTheDocument();
    expect(screen.getByText("当前设置页还没有接入令牌轮换、密钥明文查看和按范围列出的 API key 清单。")).toBeInTheDocument();
  });

  it("shows notification contract boundary instead of the general save form", () => {
    render(<SettingsWebView />);

    fireEvent.click(screen.getByRole("button", { name: "通知" }));

    expect(screen.queryByText("保存状态")).toBeNull();
    expect(screen.getByText("契约边界")).toBeInTheDocument();
    expect(screen.getByText("通知路由偏好目前仍是只读说明，只有在通知设置 API 落地后才会支持编辑。")).toBeInTheDocument();
  });
});
