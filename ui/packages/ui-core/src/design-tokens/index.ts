/**
 * Design Tokens - Three-layer architecture
 *
 * Layer 1: Primitive tokens - raw values (colors, sizes, etc.)
 * Layer 2: Semantic tokens - meaning-based references to primitives
 * Layer 3: Domain tokens - domain-specific compositions
 */

// =============================================================================
// LAYER 1: PRIMITIVE TOKENS
// Raw values that form the foundation of the design system
// =============================================================================

export interface PrimitiveTokens {
  readonly color: {
    // Neutrals
    readonly gray50: string;
    readonly gray100: string;
    readonly gray200: string;
    readonly gray300: string;
    readonly gray400: string;
    readonly gray500: string;
    readonly gray600: string;
    readonly gray700: string;
    readonly gray800: string;
    readonly gray900: string;
    readonly gray950: string;
    // Accent colors
    readonly green50: string;
    readonly green500: string;
    readonly green600: string;
    readonly blue50: string;
    readonly blue500: string;
    readonly blue600: string;
    readonly amber50: string;
    readonly amber500: string;
    readonly amber600: string;
    readonly red50: string;
    readonly red500: string;
    readonly red600: string;
    readonly sky50: string;
    readonly sky500: string;
    // Focus
    readonly focusRingBlue: string;
    readonly focusRingGreen: string;
  };
  readonly radius: {
    readonly none: string;
    readonly sm: string;
    readonly md: string;
    readonly lg: string;
    readonly xl: string;
    readonly full: string;
  };
  readonly spacing: {
    readonly 0: number;
    readonly 1: number;
    readonly 2: number;
    readonly 3: number;
    readonly 4: number;
    readonly 5: number;
    readonly 6: number;
    readonly 8: number;
    readonly 10: number;
    readonly 12: number;
    readonly 16: number;
    readonly 20: number;
    readonly 24: number;
  };
  readonly typography: {
    readonly fontFamily: {
      readonly sans: string;
      readonly mono: string;
    };
    readonly fontSize: {
      readonly xs: string;
      readonly sm: string;
      readonly base: string;
      readonly lg: string;
      readonly xl: string;
      readonly "2xl": string;
      readonly "3xl": string;
    };
    readonly lineHeight: {
      readonly none: number;
      readonly tight: number;
      readonly normal: number;
      readonly relaxed: number;
    };
    readonly fontWeight: {
      readonly normal: number;
      readonly medium: number;
      readonly semibold: number;
      readonly bold: number;
    };
  };
  readonly motion: {
    readonly duration: {
      readonly fast: string;
      readonly normal: string;
      readonly slow: string;
    };
    readonly easing: {
      readonly standard: string;
      readonly enter: string;
      readonly exit: string;
    };
  };
  readonly breakpoints: {
    readonly mobile: number;
    readonly tablet: number;
    readonly desktop: number;
    readonly wide: number;
  };
  readonly shadows: {
    readonly card: string;
    readonly overlay: string;
    readonly inset: string;
    readonly focusRing: string;
    readonly sm: string;
    readonly md: string;
    readonly lg: string;
  };
  readonly iconSizes: {
    readonly xs: number;
    readonly sm: number;
    readonly md: number;
    readonly lg: number;
    readonly xl: number;
  };
}

/** Primitive token values */
export const primitiveTokens: PrimitiveTokens = {
  color: {
    // Neutrals
    gray50: "#f8fafc",
    gray100: "#f1f5f9",
    gray200: "#e2e8f0",
    gray300: "#cbd5e1",
    gray400: "#94a3b8",
    gray500: "#64748b",
    gray600: "#475569",
    gray700: "#334155",
    gray800: "#1e293b",
    gray900: "#0f172a",
    gray950: "#020617",
    // Accent colors
    green50: "#f0fdf4",
    green500: "#22c55e",
    green600: "#16a34a",
    blue50: "#eff6ff",
    blue500: "#3b82f6",
    blue600: "#2563eb",
    amber50: "#fffbeb",
    amber500: "#f59e0b",
    amber600: "#d97706",
    red50: "#fef2f2",
    red500: "#ef4444",
    red600: "#dc2626",
    sky50: "#f0f9ff",
    sky500: "#38bdf8",
    // Focus
    focusRingBlue: "rgba(59, 130, 246, 0.24)",
    focusRingGreen: "rgba(34, 197, 94, 0.45)",
  },
  radius: {
    none: "0px",
    sm: "8px",
    md: "12px",
    lg: "18px",
    xl: "24px",
    full: "9999px",
  },
  spacing: {
    0: 0,
    1: 4,
    2: 6,
    3: 8,
    4: 10,
    5: 12,
    6: 16,
    8: 20,
    10: 24,
    12: 32,
    16: 40,
    20: 48,
    24: 64,
  },
  typography: {
    fontFamily: {
      sans: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
      mono: '"IBM Plex Mono", "Fira Code", monospace',
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "0.95rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
    },
    lineHeight: {
      none: 1,
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  motion: {
    duration: {
      fast: "120ms",
      normal: "220ms",
      slow: "400ms",
    },
    easing: {
      standard: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      enter: "cubic-bezier(0, 0, 0.2, 1)",
      exit: "cubic-bezier(0.2, 0, 1, 1)",
    },
  },
  breakpoints: {
    mobile: 640,
    tablet: 960,
    desktop: 1280,
    wide: 1536,
  },
  shadows: {
    card: "0 10px 24px rgba(15, 23, 42, 0.08)",
    overlay: "0 16px 40px rgba(15, 23, 42, 0.12)",
    inset: "inset 0 1px 0 rgba(255,255,255,0.75)",
    focusRing: "0 0 0 3px rgba(37, 99, 235, 0.24)",
    sm: "0 1px 2px rgba(15, 23, 42, 0.05)",
    md: "0 4px 6px rgba(15, 23, 42, 0.07)",
    lg: "0 10px 15px rgba(15, 23, 42, 0.1)",
  },
  iconSizes: {
    xs: 12,
    sm: 14,
    md: 18,
    lg: 24,
    xl: 32,
  },
};

// =============================================================================
// LAYER 2: SEMANTIC TOKENS
// Meaning-based references to primitives, organized by intent
// =============================================================================

export interface SemanticTokens {
  readonly color: {
    readonly background: string;
    readonly surface: string;
    readonly surfaceElevated: string;
    readonly surfaceHover: string;
    readonly border: string;
    readonly borderStrong: string;
    readonly accent: string;
    readonly accentHover: string;
    readonly text: string;
    readonly textSecondary: string;
    readonly textSubtle: string;
    readonly planned: string;
    readonly danger: string;
    readonly dangerHover: string;
    readonly success: string;
    readonly successHover: string;
    readonly warning: string;
    readonly warningHover: string;
    readonly info: string;
    readonly focusRing: string;
    // Risk level tokens
    readonly riskLow: string;
    readonly riskMedium: string;
    readonly riskHigh: string;
    readonly riskCritical: string;
    // Autonomy level tokens
    readonly autonomyManual: string;
    readonly autonomyAssisted: string;
    readonly autonomyAutonomous: string;
    readonly autonomyFull: string;
  };
  readonly radius: {
    readonly button: string;
    readonly card: string;
    readonly input: string;
    readonly badge: string;
    readonly lg: string;
    readonly sm: string;
  };
  readonly spacing: {
    readonly buttonPaddingX: number;
    readonly buttonPaddingY: number;
    readonly inputPaddingX: number;
    readonly inputPaddingY: number;
    readonly cardPadding: number;
    readonly sectionGap: number;
  };
  readonly typography: {
    readonly fontFamily: string;
    readonly headingSize: string;
    readonly bodySize: string;
    readonly monoFamily: string;
    readonly headingLineHeight: number;
    readonly bodyLineHeight: number;
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

/** Semantic tokens derived from primitives */
export const semanticTokens: SemanticTokens = {
  color: {
    background: primitiveTokens.color.gray50,
    surface: "#ffffff",
    surfaceElevated: primitiveTokens.color.gray100,
    surfaceHover: primitiveTokens.color.gray50,
    border: primitiveTokens.color.gray300,
    borderStrong: primitiveTokens.color.gray400,
    accent: primitiveTokens.color.green500,
    accentHover: primitiveTokens.color.green600,
    text: primitiveTokens.color.gray900,
    textSecondary: primitiveTokens.color.gray700,
    textSubtle: primitiveTokens.color.gray500,
    planned: primitiveTokens.color.amber500,
    danger: primitiveTokens.color.red500,
    dangerHover: primitiveTokens.color.red600,
    success: primitiveTokens.color.green500,
    successHover: primitiveTokens.color.green600,
    warning: primitiveTokens.color.amber500,
    warningHover: primitiveTokens.color.amber600,
    info: primitiveTokens.color.sky500,
    focusRing: primitiveTokens.color.focusRingBlue,
    // Risk levels
    riskLow: primitiveTokens.color.green500,
    riskMedium: primitiveTokens.color.amber500,
    riskHigh: primitiveTokens.color.red500,
    riskCritical: primitiveTokens.color.red600,
    // Autonomy levels
    autonomyManual: primitiveTokens.color.blue500,
    autonomyAssisted: primitiveTokens.color.sky500,
    autonomyAutonomous: primitiveTokens.color.green500,
    autonomyFull: primitiveTokens.color.green600,
  },
  radius: {
    button: primitiveTokens.radius.sm,
    card: primitiveTokens.radius.md,
    input: primitiveTokens.radius.sm,
    badge: primitiveTokens.radius.full,
    lg: primitiveTokens.radius.lg,
    sm: primitiveTokens.radius.sm,
  },
  spacing: {
    buttonPaddingX: 16,
    buttonPaddingY: 10,
    inputPaddingX: 12,
    inputPaddingY: 10,
    cardPadding: 16,
    sectionGap: 24,
  },
  typography: {
    fontFamily: primitiveTokens.typography.fontFamily.sans,
    headingSize: primitiveTokens.typography.fontSize["2xl"],
    bodySize: primitiveTokens.typography.fontSize.base,
    monoFamily: primitiveTokens.typography.fontFamily.mono,
    headingLineHeight: primitiveTokens.typography.lineHeight.tight,
    bodyLineHeight: primitiveTokens.typography.lineHeight.normal,
    fontWeight: {
      medium: primitiveTokens.typography.fontWeight.medium,
      semibold: primitiveTokens.typography.fontWeight.semibold,
      bold: primitiveTokens.typography.fontWeight.bold,
    },
  },
  motion: {
    fast: primitiveTokens.motion.duration.fast,
    normal: primitiveTokens.motion.duration.normal,
    easing: primitiveTokens.motion.easing.standard,
  },
  breakpoints: {
    mobile: primitiveTokens.breakpoints.mobile,
    tablet: primitiveTokens.breakpoints.tablet,
    desktop: primitiveTokens.breakpoints.desktop,
  },
  shadows: {
    card: primitiveTokens.shadows.card,
    overlay: primitiveTokens.shadows.overlay,
    inset: primitiveTokens.shadows.inset,
    focusRing: primitiveTokens.shadows.focusRing,
  },
  iconSizes: {
    sm: primitiveTokens.iconSizes.sm,
    md: primitiveTokens.iconSizes.md,
    lg: primitiveTokens.iconSizes.lg,
  },
};

// =============================================================================
// LAYER 3: DOMAIN TOKENS
// Domain-specific tokens composed from semantic tokens
// =============================================================================

export interface DomainTokens {
  readonly workflow: {
    readonly stepPending: string;
    readonly stepActive: string;
    readonly stepCompleted: string;
    readonly stepFailed: string;
    readonly transitionDelay: string;
  };
  readonly task: {
    readonly priorityLow: string;
    readonly priorityMedium: string;
    readonly priorityHigh: string;
    readonly priorityUrgent: string;
    readonly statusPending: string;
    readonly statusRunning: string;
    readonly statusCompleted: string;
    readonly statusFailed: string;
    readonly statusCancelled: string;
    readonly statusPaused: string;
  };
  readonly execution: {
    readonly sandboxBorder: string;
    readonly approvalBorder: string;
    readonly retryCountBadge: string;
  };
  readonly riskLevel: {
    readonly low: string;
    readonly medium: string;
    readonly high: string;
    readonly critical: string;
  };
  readonly autonomyLevel: {
    readonly manual: string;
    readonly assisted: string;
    readonly autonomous: string;
    readonly full: string;
  };
}

/** Domain-specific tokens */
export const domainTokens: DomainTokens = {
  workflow: {
    stepPending: semanticTokens.color.textSubtle,
    stepActive: semanticTokens.color.accent,
    stepCompleted: semanticTokens.color.success,
    stepFailed: semanticTokens.color.danger,
    transitionDelay: primitiveTokens.motion.duration.normal,
  },
  task: {
    priorityLow: semanticTokens.color.info,
    priorityMedium: semanticTokens.color.textSecondary,
    priorityHigh: semanticTokens.color.warning,
    priorityUrgent: semanticTokens.color.danger,
    statusPending: semanticTokens.color.textSubtle,
    statusRunning: semanticTokens.color.accent,
    statusCompleted: semanticTokens.color.success,
    statusFailed: semanticTokens.color.danger,
    statusCancelled: semanticTokens.color.textSubtle,
    statusPaused: semanticTokens.color.warning,
  },
  execution: {
    sandboxBorder: semanticTokens.color.border,
    approvalBorder: semanticTokens.color.warning,
    retryCountBadge: semanticTokens.color.accent,
  },
  riskLevel: {
    low: semanticTokens.color.riskLow,
    medium: semanticTokens.color.riskMedium,
    high: semanticTokens.color.riskHigh,
    critical: semanticTokens.color.riskCritical,
  },
  autonomyLevel: {
    manual: semanticTokens.color.autonomyManual,
    assisted: semanticTokens.color.autonomyAssisted,
    autonomous: semanticTokens.color.autonomyAutonomous,
    full: semanticTokens.color.autonomyFull,
  },
};

// =============================================================================
// COMPOSITE EXPORT
// Provides unified access to all token layers
// =============================================================================

export interface CoreDesignTokens {
  readonly primitive: PrimitiveTokens;
  readonly semantic: SemanticTokens;
  readonly domain: DomainTokens;
  // Backward-compatible flat access (deprecated)
  readonly color: SemanticTokens["color"];
  readonly radius: SemanticTokens["radius"];
  readonly typography: PrimitiveTokens["typography"];
  readonly motion: { readonly fast: string; readonly normal: string; readonly easing: string };
  readonly spacing: SemanticTokens["spacing"];
  readonly shadows: SemanticTokens["shadows"];
  readonly iconSizes: SemanticTokens["iconSizes"];
  readonly breakpoints: SemanticTokens["breakpoints"];
  readonly subtle: string;
}

/**
 * Complete design token set with three-layer architecture.
 * Access via: designTokens.primitive.color.gray50
 *            designTokens.semantic.color.background
 *            designTokens.domain.riskLevel.critical
 */
export const designTokens: CoreDesignTokens = {
  primitive: primitiveTokens,
  semantic: semanticTokens,
  domain: domainTokens,
  // Backward-compatible flat access (deprecated)
  color: semanticTokens.color,
  radius: semanticTokens.radius,
  typography: primitiveTokens.typography,
  motion: semanticTokens.motion,
  spacing: semanticTokens.spacing,
  shadows: semanticTokens.shadows,
  iconSizes: semanticTokens.iconSizes,
  breakpoints: semanticTokens.breakpoints,
  subtle: semanticTokens.color.textSubtle,
};

/**
 * Legacy flat access for backward compatibility.
 * @deprecated Use designTokens.semantic instead for new code.
 */
export const legacyDesignTokens: Omit<CoreDesignTokens["semantic"], "riskLevel" | "autonomyLevel"> = {
  color: semanticTokens.color,
  radius: semanticTokens.radius,
  spacing: semanticTokens.spacing,
  typography: semanticTokens.typography,
  motion: semanticTokens.motion,
  breakpoints: semanticTokens.breakpoints,
  shadows: semanticTokens.shadows,
  iconSizes: semanticTokens.iconSizes,
};

export { animation, prefersReducedMotion, getAnimationDuration, getAnimationEasing } from "./animation";

/**
 * Creates a panel style using semantic tokens.
 * @deprecated Use semantic tokens directly.
 */
export function createPanelStyle(accent = semanticTokens.color.border): {
  background: string;
  border: string;
  borderRadius: string;
  padding: number;
} {
  return {
    background: semanticTokens.color.surface,
    border: `1px solid ${accent}`,
    borderRadius: semanticTokens.radius.card,
    padding: semanticTokens.spacing.cardPadding,
  };
}
