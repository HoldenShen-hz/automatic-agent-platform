/**
 * Livestream OBS/Stream adapter plugin.
 *
 * Integrates with OBS WebSocket and streaming platforms to retrieve configuration
 * and analytics data.
 *
 * §G8: Livestream domain adapter — M2 Phase 5.
 */
import type { ExternalAdapterPlugin } from "../../domains/registry/plugin-spi.js";
export declare function createLivestreamAdapterPlugin(): ExternalAdapterPlugin;
