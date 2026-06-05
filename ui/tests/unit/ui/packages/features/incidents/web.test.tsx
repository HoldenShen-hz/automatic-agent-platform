// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const viewModel = {
  items: [
    {
      id: "incident-resolved",
      title: "resolved · Closed incident",
      description: "Already resolved",
      detailRows: [
        { key: "Status", value: "resolved" },
        { key: "Owner", value: "platform-operator" },
      ],
    },
    {
      id: "incident-open",
      title: "open · New incident",
      description: "Requires acknowledgement",
      detailRows: [
        { key: "Status", value: "open" },
        { key: "Owner", value: "unassigned" },
      ],
    },
    {
      id: "incident-ack",
      title: "acknowledged · Active incident",
      description: "Can enter mitigation",
      detailRows: [
        { key: "Status", value: "acknowledged" },
        { key: "Owner", value: "platform-operator" },
      ],
    },
  ],
  acknowledgeIncident: vi.fn(async () => undefined),
  startMitigation: vi.fn(async () => undefined),
  resolveIncident: vi.fn(async () => undefined),
};

vi.mock("../../../../../../packages/features/incidents/src/hooks", () => ({
  useIncidentsVm: () => viewModel,
}));

import { IncidentsWebView } from "../../../../../../packages/features/incidents/src/web";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("IncidentsWebView", () => {
  it("disables invalid transitions for the selected incident and enables valid ones after selection changes", () => {
    render(<IncidentsWebView />);

    expect(screen.getByRole("button", { name: "认领并确认" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "进入处置" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "关闭事件" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByText("open · New incident"));
    expect(screen.getByRole("button", { name: "认领并确认" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "进入处置" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByText("acknowledged · Active incident"));
    expect(screen.getByRole("button", { name: "认领并确认" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "进入处置" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "关闭事件" }).hasAttribute("disabled")).toBe(true);
  });
});
