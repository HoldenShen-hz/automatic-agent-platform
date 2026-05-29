/**
 * Animation utilities with prefers-reduced-motion support
 *
 * Respects user's motion preferences to provide accessible animations.
 * When user prefers reduced motion, returns values that minimize or eliminate animation.
 */
/** Check if user prefers reduced motion */
export function prefersReducedMotion() {
    if (typeof window === "undefined") {
        return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
/** Get animation duration based on user preference */
export function getAnimationDuration(fast = "60ms", normal = "120ms", slow = "200ms") {
    if (prefersReducedMotion()) {
        return { fast: "0ms", normal: "0ms", slow: "0ms" };
    }
    return { fast, normal, slow };
}
/** Get animation easing based on user preference */
export function getAnimationEasing(standard = "cubic-bezier(0.2, 0.8, 0.2, 1)", enter = "cubic-bezier(0, 0, 0.2, 1)", exit = "cubic-bezier(0.2, 0, 1, 1)") {
    if (prefersReducedMotion()) {
        return { standard: "linear", enter: "linear", exit: "linear" };
    }
    return { standard, enter, exit };
}
/** Create CSS keyframes string with reduced motion fallback */
export function createKeyframes(name, frames) {
    if (prefersReducedMotion()) {
        return "";
    }
    const frameStrings = Object.entries(frames)
        .map(([step, style]) => `${step} { ${style} }`)
        .join(" ");
    return `@keyframes ${name} { ${frameStrings} }`;
}
/** Animation utility object for use in components */
export const animation = {
    get duration() {
        return getAnimationDuration();
    },
    get easing() {
        return getAnimationEasing();
    },
    get durations() {
        return {
            fast: prefersReducedMotion() ? "0ms" : "120ms",
            normal: prefersReducedMotion() ? "0ms" : "220ms",
            slow: prefersReducedMotion() ? "0ms" : "400ms",
        };
    },
    get easings() {
        return {
            standard: prefersReducedMotion() ? "linear" : "cubic-bezier(0.2, 0.8, 0.2, 1)",
            enter: prefersReducedMotion() ? "linear" : "cubic-bezier(0, 0, 0.2, 1)",
            exit: prefersReducedMotion() ? "linear" : "cubic-bezier(0.2, 0, 1, 1)",
        };
    },
};
export default animation;
