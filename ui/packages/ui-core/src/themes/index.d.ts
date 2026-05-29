import { type CoreDesignTokens } from "../design-tokens";
export interface ThemeRuntimeBridge {
    applyResolvedTheme(name: "light" | "dark" | "high-contrast"): CoreDesignTokens;
}
export declare const lightTheme: CoreDesignTokens;
export declare const darkTheme: CoreDesignTokens;
export declare const highContrastTheme: CoreDesignTokens;
export declare function resolveTheme(name: "light" | "dark" | "high-contrast"): CoreDesignTokens;
export declare function applyResolvedTheme(name: "light" | "dark" | "high-contrast", root?: Pick<HTMLElement, "dataset" | "style">): CoreDesignTokens;
