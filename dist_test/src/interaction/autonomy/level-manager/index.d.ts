import type { AutonomyLevel } from "../index.js";
export declare const AUTONOMY_LEVEL_ORDER: readonly AutonomyLevel[];
export declare function compareAutonomyLevels(left: AutonomyLevel, right: AutonomyLevel): number;
export declare function nextAutonomyLevel(current: AutonomyLevel): AutonomyLevel;
