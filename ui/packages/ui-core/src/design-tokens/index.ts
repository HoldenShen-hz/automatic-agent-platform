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
    readonly success: string;
    readonly warning: string;
    readonly info: string;
    readonly focusRing: string;
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
    readonly xl: number;
    readonly xxl: number;
  };
  readonly typography: {
    readonly fontFamily: string;
    readonly headingSize: string;
    readonly bodySize: string;
    readonly monoFamily: string;
    readonly lineHeight: {
      readonly compact: number;
      readonly comfortable: number;
      readonly spacious: number;
    };
    readonly fontWeight: {
      readonly medium: number;
      readonly semibold: number;
      readonly bold: number;
    };
  };
  readonly motion: {
    readonly fast: string;
    readonly normal: string;
    readonly easing: string;
  };
  readonly breakpoints: {
    readonly mobile: number;
    readonly tablet: number;
    readonly desktop: number;
  };
  readonly shadows: {
    readonly card: string;
    readonly overlay: string;
    readonly inset: string;
    readonly focusRing: string;
  };
  readonly iconSizes: {
    readonly sm: number;
    readonly md: number;
    readonly lg: number;
  };
}

export const designTokens: CoreDesignTokens = {
  color: {
    background: "#f8fafc",
    surface: "#ffffff",
    surfaceElevated: "#f1f5f9",
    border: "#cbd5e1",
    accent: "#22c55e",
    text: "#0f172a",
    subtle: "#475569",
    planned: "#f59e0b",
    danger: "#ef4444",
    success: "#34d399",
    warning: "#fbbf24",
    info: "#38bdf8",
    focusRing: "rgba(56, 189, 248, 0.45)",
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
    xl: 32,
    xxl: 48,
  },
  typography: {
    fontFamily: "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
    headingSize: "1.5rem",
    bodySize: "0.95rem",
    monoFamily: "\"IBM Plex Mono\", monospace",
    lineHeight: {
      compact: 1.2,
      comfortable: 1.5,
      spacious: 1.75,
    },
    fontWeight: {
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  motion: {
    fast: "120ms",
    normal: "220ms",
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  },
  breakpoints: {
    mobile: 640,
    tablet: 960,
    desktop: 1280,
  },
  shadows: {
    card: "0 10px 24px rgba(15, 23, 42, 0.08)",
    overlay: "0 16px 40px rgba(15, 23, 42, 0.12)",
    inset: "inset 0 1px 0 rgba(255,255,255,0.75)",
    focusRing: "0 0 0 3px rgba(37, 99, 235, 0.24)",
  },
  iconSizes: {
    sm: 14,
    md: 18,
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
