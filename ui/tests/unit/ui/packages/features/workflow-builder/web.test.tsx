// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@aa/ui-core", () => ({
  FeatureScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ListCard: ({ items }: { items: Array<{ title: string; description: string }> }) => (
    <div>{items.map((item) => <div key={`${item.title}-${item.description}`}>{`${item.title} ${item.description}`}</div>)}</div>
  ),
  designTokens: {
    color: {
      border: "#ddd",
      surface: "#fff",
      surfaceSelected: "#f5f5f5",
    },
  },
}));

vi.mock("../../../../../../packages/features/workflow-builder/src/hooks", () => ({
  useWorkflowBuilderVm: () => ({
    items: [{ title: "暂无工作流草稿", description: "请先创建工作流草稿，再查看或编辑真实构建图。" }],
    drafts: [],
    selectedDraftId: null,
    draftTitle: "",
    nodes: [],
    edges: [],
    validationMessages: [],
    statusMessage: "Draft deleted.",
    isMutating: false,
    canSave: false,
    canDelete: false,
    setSelectedDraftId: vi.fn(),
    setDraftTitle: vi.fn(),
    createDraft: vi.fn(async () => undefined),
    saveDraft: vi.fn(async () => undefined),
    deleteDraft: vi.fn(async () => undefined),
  }),
}));

import { WorkflowBuilderWebView } from "../../../../../../packages/features/workflow-builder/src/web";

afterEach(() => {
  cleanup();
});

describe("WorkflowBuilderWebView", () => {
  it("renders draft-oriented empty state copy when no draft is selected", () => {
    render(<WorkflowBuilderWebView />);

    expect(screen.getByText("请先创建工作流草稿，再查看或编辑真实构建图。")).toBeInTheDocument();
    expect(screen.getByText("当前还没有选中的工作流草稿。")).toBeInTheDocument();
    expect(screen.getByText("暂无工作流草稿 请先创建工作流草稿，再查看或编辑真实构建图。")).toBeInTheDocument();
  });
});
