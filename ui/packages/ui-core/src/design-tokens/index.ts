export interface CoreDesignTokens {
  readonly color: {
    readonly background: string;
    readonly surface: string;
    readonly surfaceElevated: string;
    readonly border: string;
    readonly accent: string;
    readonly text: string;
    readonly subtle: string;
    readonly planned: string;
    readonly danger: string;
  };
  readonly radius: {
    readonly sm: string;
    readonly md: string;
    readonly lg: string;
  };
  readonly spacing: {
    readonly xs: number;
    readonly sm: number;
    readonly md: number;
    readonly lg: number;
  };
}

export const designTokens: CoreDesignTokens = {
  color: {
    background: "#0f172a",
    surface: "#111827",
    surfaceElevated: "#162034",
    border: "#334155",
    accent: "#22c55e",
    text: "#e5e7eb",
    subtle: "#94a3b8",
    planned: "#f59e0b",
    danger: "#ef4444",
  },
  radius: {
    sm: "8px",
    md: "12px",
    lg: "18px",
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
  },
};

export function createPanelStyle(accent = designTokens.color.border) {
  return {
    background: designTokens.color.surface,
    border: `1px solid ${accent}`,
    borderRadius: designTokens.radius.md,
    padding: designTokens.spacing.md,
  };
}
