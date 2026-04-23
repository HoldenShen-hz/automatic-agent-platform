import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import compliance from "../../packages/features/compliance/src/index";

describe("compliance feature", () => {
  it("renders a dedicated compliance center instead of a bare re-export", () => {
    render(<compliance.Component />);

    expect(screen.getByText("Compliance")).toBeInTheDocument();
    expect(screen.getByText("Run Check")).toBeInTheDocument();
    expect(screen.getByText("Export Report")).toBeInTheDocument();
    expect(compliance.route.path).toBe("/governance/compliance");
    expect(compliance.manifest.id).toBe("compliance");
  });
});
