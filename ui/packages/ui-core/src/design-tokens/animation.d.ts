/**
 * Animation utilities with prefers-reduced-motion support
 *
 * Respects user's motion preferences to provide accessible animations.
 * When user prefers reduced motion, returns values that minimize or eliminate animation.
 */
/** Check if user prefers reduced motion */
export declare function prefersReducedMotion(): boolean;
/** Get animation duration based on user preference */
export declare function getAnimationDuration(fast?: string, normal?: string, slow?: string): {
    fast: string;
    normal: string;
    slow: string;
};
/** Get animation easing based on user preference */
export declare function getAnimationEasing(standard?: string, enter?: string, exit?: string): {
    standard: string;
    enter: string;
    exit: string;
};
/** Create CSS keyframes string with reduced motion fallback */
export declare function createKeyframes(name: string, frames: Record<string, string>): string;
/** Animation utility object for use in components */
export declare const animation: {
    readonly duration: {
        fast: string;
        normal: string;
        slow: string;
    };
    readonly easing: {
        standard: string;
        enter: string;
        exit: string;
    };
    readonly durations: {
        fast: string;
        normal: string;
        slow: string;
    };
    readonly easings: {
        standard: string;
        enter: string;
        exit: string;
    };
};
export default animation;
