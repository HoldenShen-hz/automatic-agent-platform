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
    readonly color: SemanticDesignTokens["color"] & {
        readonly subtle: string;
    };
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
export declare const primitiveTokens: PrimitiveDesignTokens;
export declare const semanticTokens: SemanticDesignTokens;
export declare const designTokens: CoreDesignTokens;
export declare function createPanelStyle(accent?: string): {
    background: string;
    border: string;
    borderRadius: string;
    padding: number;
};
