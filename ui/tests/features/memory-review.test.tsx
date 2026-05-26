import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import memoryReview from "../../packages/features/memory-review/src/index";

describe("memory review feature", () => {
  it("renders the memory review console contract", () => {
    render(<memoryReview.Component />);

    expect(screen.getByText("Memory Review Console")).toBeInTheDocument();
    expect(screen.getByText("批准提案")).toBeInTheDocument();
    expect(screen.getByText("撤销记忆")).toBeInTheDocument();
    expect(screen.getByText("导出审计包")).toBeInTheDocument();
    expect(memoryReview.route.path).toBe("/governance/memory-review");
    expect(memoryReview.manifest.id).toBe("memory-review");
  });
});
