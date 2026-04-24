import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryWSClient } from "@aa/shared-api-client";
import { App } from "../../apps/web/src/App";

function renderAt(path: string) {
  return render(<App initialEntries={[path]} router="memory" wsClient={new InMemoryWSClient()} />);
}

describe("web app route smoke", () => {
  afterEach(() => {
    cleanup();
  });

  it("loads approval route and allows operator decisions from app shell", async () => {
    renderAt("/mission-control/approvals");

    expect(await screen.findByText("Approval Center")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /task-2/i }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByText(/Approved/)).toBeInTheDocument();
  });

  it("navigates from dashboard to shared settings and persists visible save state", async () => {
    renderAt("/mission-control/dashboard");

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Settings" }));
    expect(await screen.findByText("Settings")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Save Settings" }));
    expect(await screen.findByText(/Save State: saved/i)).toBeInTheDocument();
  });
});
