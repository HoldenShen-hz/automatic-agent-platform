/**
 * Circuit Breaker Event Bus Integration
 *
 * Emits circuit breaker state change events to the event bus per §9.4.
 * State changes write logs AND emit events to the event bus.
 */

import type { CircuitBreakerStateChangePayload } from "./circuit-breaker.js";

/**
 * Event bus emitter function type.
 */
export type EventBusEmitter = (eventType: string, payload: unknown) => void;

/**
 * Circuit breaker event bus integration.
 * Provides event emission for circuit breaker state changes.
 */
export class CircuitBreakerEventBus {
  private emitter: EventBusEmitter | null = null;

  /**
   * Set the event bus emitter.
   */
  public setEmitter(emitter: EventBusEmitter): void {
    this.emitter = emitter;
  }

  /**
   * Emit circuit breaker state change event.
   */
  public emitStateChange(payload: CircuitBreakerStateChangePayload): void {
    if (this.emitter == null) {
      return;
    }
    this.emitter("circuit_breaker:state_changed", payload);
  }

  /**
   * Create a state change handler for circuit breaker.
   */
  public createStateChangeHandler(): (payload: CircuitBreakerStateChangePayload) => void {
    return (payload) => this.emitStateChange(payload);
  }
}

/**
 * Global circuit breaker event bus instance.
 */
export const globalCircuitBreakerEventBus = new CircuitBreakerEventBus();