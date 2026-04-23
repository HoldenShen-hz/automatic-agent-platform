import type { HarnessRole } from "./index.js";
export type OapeflirSemanticPhase = "observe" | "assess" | "plan" | "execute" | "feedback" | "learn" | "improve" | "release";
export declare function mapHarnessStepToOapeflirPhase(role: HarnessRole, stage: string): OapeflirSemanticPhase;
