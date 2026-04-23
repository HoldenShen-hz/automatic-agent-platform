/**
 * Game Dev Unity Cloud Build adapter plugin.
 *
 * Integrates with Unity Cloud Build to retrieve build status, logs, and artifacts.
 *
 * §G8: Game Dev domain adapter — M2 Phase 3.
 */
import type { ExternalAdapterPlugin } from "../../domains/registry/plugin-spi.js";
export declare function createGameDevAdapterPlugin(): ExternalAdapterPlugin;
