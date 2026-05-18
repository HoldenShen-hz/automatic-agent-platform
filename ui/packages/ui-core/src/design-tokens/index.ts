export { animation } from "./animation";

export interface PrimitiveDesignTokens {
  readonly color: {
    readonly slate050: string;
    readonly slate100: string;
    readonly slate200: string;
    readonly slate400: string;
    readonly slate600: string;
    readonly slate900: string;
    readonly emerald500: string;
    readonly emerald400: string;
    readonly amber500: string;
    readonly red500: string;
    readonly sky500: string;
    readonly ink950: string;
    readonly white: string;
  };
  readonly radius: {
    readonly sm: string;
    readonly md: string;
    readonly lg: string;
    readonly pill: string;
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
    readonly fontFamily: {
      readonly sans: string;
      readonly mono: string;
    };
    readonly fontSize: {
      readonly sm: string;
      readonly base: string;
      readonly lg: string;
      readonly xl: string;
      readonly "2xl": string;
    };
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
    readonly duration: {
      readonly fast: string;
      readonly normal: string;
    };
    readonly easing: {
      readonly standard: string;
    };
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

export interface SemanticDesignTokens {
  readonly color: {
    readonly background: string;
    readonly surface: string;
    readonly surfaceElevated: string;
    readonly surfaceHover: string;
    readonly surfaceSelected: string;
    readonly border: string;
    readonly borderStrong: string;
    readonly accent: string;
    readonly text: string;
    readonly textSubtle: string;
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
    readonly input: string;
    readonly card: string;
  };
  readonly typography: {
    readonly fontFamily: string;
    readonly monoFamily: string;
    readonly headingSize: string;
    readonly bodySize: string;
    readonly lineHeight: PrimitiveDesignTokens["typography"]["lineHeight"];
    readonly fontWeight: PrimitiveDesignTokens["typography"]["fontWeight"];
  };
  readonly spacing: PrimitiveDesignTokens["spacing"];
  readonly motion: {
    readonly fast: string;
    readonly normal: string;
    readonly easing: string;
  };
  readonly shadows: PrimitiveDesignTokens["shadows"];
}

export interface CoreDesignTokens {
  readonly primitive: PrimitiveDesignTokens;
  readonly semantic: SemanticDesignTokens;
  readonly color: SemanticDesignTokens["color"] & { readonly subtle: string };
  readonly radius: {
    readonly sm: string;
    readonly md: string;
    readonly lg: string;
  };
  readonly spacing: PrimitiveDesignTokens["spacing"];
  readonly typography: {
    readonly fontFamily: string;
    readonly headingSize: string;
    readonly bodySize: string;
    readonly monoFamily: string;
    readonly lineHeight: PrimitiveDesignTokens["typography"]["lineHeight"];
    readonly fontWeight: PrimitiveDesignTokens["typography"]["fontWeight"];
  };
  readonly motion: {
    readonly fast: string;
    readonly normal: string;
    readonly easing: string;
  };
  readonly breakpoints: PrimitiveDesignTokens["breakpoints"];
  readonly shadows: PrimitiveDesignTokens["shadows"];
  readonly iconSizes: PrimitiveDesignTokens["iconSizes"];
}

export const primitiveTokens: PrimitiveDesignTokens = {
  color: {
    slate050: "#f8fafc",
    slate100: "#f1f5f9",
    slate200: "#cbd5e1",
    slate400: "#94a3b8",
    slate600: "#475569",
    slate900: "#0f172a",
    emerald500: "#22c55e",
    emerald400: "#34d399",
    amber500: "#f59e0b",
    red500: "#ef4444",
    sky500: "#38bdf8",
    ink950: "#12201a",
    white: "#ffffff",
  },
  radius: {
    sm: "8px",
    md: "12px",
    lg: "18px",
    pill: "999px",
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
    fontFamily: {
      sans: "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
      mono: "\"IBM Plex Mono\", monospace",
    },
    fontSize: {
      sm: "0.875rem",
      base: "0.95rem",
      lg: "1.125rem",
      xl: "1.5rem",
      "2xl": "1.875rem",
    },
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
    duration: {
      fast: "120ms",
      normal: "220ms",
    },
    easing: {
      standard: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    },
  },
  breakpoints: {
    mobile: 768,
    tablet: 1024,
    desktop: 1440,
  },
  shadows: {
    card: "0 10px 24px rgba(15, 23, 42, 0.08)",
    overlay: "0 16px 40px rgba(15, 23, 42, 0.12)",
    inset: "inset 0 1px 0 rgba(255,255,255,0.75)",
    focusRing: "0 0 0 3px rgba(56, 189, 248, 0.32)",
  },
  iconSizes: {
    sm: 14,
    md: 18,
    lg: 24,
  },
};

export const semanticTokens: SemanticDesignTokens = {
  color: {
    background: primitiveTokens.color.slate050,
    surface: primitiveTokens.color.white,
    surfaceElevated: primitiveTokens.color.slate100,
    surfaceHover: "#e2e8f0",
    surfaceSelected: "#e8f7ee",
    border: primitiveTokens.color.slate200,
    borderStrong: primitiveTokens.color.slate400,
    accent: primitiveTokens.color.emerald500,
    text: primitiveTokens.color.slate900,
    textSubtle: primitiveTokens.color.slate600,
    planned: primitiveTokens.color.amber500,
    danger: primitiveTokens.color.red500,
    success: primitiveTokens.color.emerald400,
    warning: "#fbbf24",
    info: primitiveTokens.color.sky500,
    focusRing: "rgba(56, 189, 248, 0.45)",
  },
  radius: {
    sm: primitiveTokens.radius.sm,
    md: primitiveTokens.radius.md,
    lg: primitiveTokens.radius.lg,
    input: primitiveTokens.radius.sm,
    card: primitiveTokens.radius.md,
  },
  typography: {
    fontFamily: primitiveTokens.typography.fontFamily.sans,
    monoFamily: primitiveTokens.typography.fontFamily.mono,
    headingSize: primitiveTokens.typography.fontSize.xl,
    bodySize: primitiveTokens.typography.fontSize.base,
    lineHeight: primitiveTokens.typography.lineHeight,
    fontWeight: primitiveTokens.typography.fontWeight,
  },
  spacing: primitiveTokens.spacing,
  motion: {
    fast: primitiveTokens.motion.duration.fast,
    normal: primitiveTokens.motion.duration.normal,
    easing: primitiveTokens.motion.easing.standard,
  },
  shadows: primitiveTokens.shadows,
};

export const designTokens: CoreDesignTokens = {
  primitive: primitiveTokens,
  semantic: semanticTokens,
  color: {
    ...semanticTokens.color,
    subtle: semanticTokens.color.textSubtle,
  },
  radius: {
    sm: semanticTokens.radius.sm,
    md: semanticTokens.radius.md,
    lg: semanticTokens.radius.lg,
  },
  spacing: primitiveTokens.spacing,
  typography: {
    fontFamily: semanticTokens.typography.fontFamily,
    headingSize: semanticTokens.typography.headingSize,
    bodySize: semanticTokens.typography.bodySize,
    monoFamily: semanticTokens.typography.monoFamily,
    lineHeight: semanticTokens.typography.lineHeight,
    fontWeight: semanticTokens.typography.fontWeight,
  },
  motion: semanticTokens.motion,
  breakpoints: primitiveTokens.breakpoints,
  shadows: primitiveTokens.shadows,
  iconSizes: primitiveTokens.iconSizes,
};

export function createPanelStyle(accent = designTokens.semantic.color.border) {
  return {
    background: designTokens.semantic.color.surface,
    border: `1px solid ${accent}`,
    borderRadius: designTokens.semantic.radius.card,
    padding: designTokens.spacing.md,
  };
}
