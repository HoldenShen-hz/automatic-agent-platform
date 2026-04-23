import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../apps/web/src/App";

describe("web app", () => {
  it("renders the ui shell and default dashboard route", () => {
    render(<App />);
    expect(screen.getByText("Automatic Agent Platform UI")).toBeInTheDocument();
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
  });
});
