export interface GuardrailActionSignal {
  readonly runId: string;
  readonly signature: string;
  readonly observedAtMs: number;
}

export interface GuardrailVibrationState {
  readonly guardrailActionCount: number;
  readonly lastGuardrailSignature: string | null;
  readonly guardrailCooldownUntilMs: number | null;
}

export interface GuardrailVibrationDecision {
  readonly allowed: boolean;
  readonly state: GuardrailVibrationState;
  readonly reasonCode: "guardrail.allowed" | "guardrail.cooldown";
}

export class GuardrailVibrationBreaker {
  public constructor(
    private readonly maxRepeatedActions: number,
    private readonly cooldownMs: number,
  ) {}

  public evaluate(signal: GuardrailActionSignal, state: GuardrailVibrationState): GuardrailVibrationDecision {
    // R23-40 fix: Track all repeated signals (not just consecutive) to detect vibration patterns.
    // The original bug: only consecutive same signatures were counted, so alternating A,B,A,B never tripped.
    // With cooldown, we now reject signals within the cooldown window, but after cooldown expires,
    // we need to reset appropriately to prevent immediate re-trip.
    //
    // CooldownExpiry semantics:
    // - null: not in cooldown
    // - > now: in cooldown, reject all signals
    // - <= now: cooldown just expired, reset based on signature
    const cooldownExpiry = state.guardrailCooldownUntilMs;

    // If in cooldown period (cooldownExpiry > now), reject regardless of signature
    if (cooldownExpiry != null && signal.observedAtMs < cooldownExpiry) {
      return {
        allowed: false,
        state,
        reasonCode: "guardrail.cooldown",
      };
    }

    // Cooldown just expired (cooldownExpiry <= now) - first signal after cooldown
    if (cooldownExpiry != null && signal.observedAtMs >= cooldownExpiry) {
      const repeated = state.lastGuardrailSignature === signal.signature;
      // R23-40 fix: After cooldown expires, if same signature appears again, start fresh at count=1.
      // This prevents the same signal from immediately re-tripping the breaker.
      // If a different signature appears, also start fresh since it's a new observation window.
      const nextState: GuardrailVibrationState = {
        guardrailActionCount: 1,
        lastGuardrailSignature: signal.signature,
        guardrailCooldownUntilMs: null,
      };
      return {
        allowed: true,
        state: nextState,
        reasonCode: "guardrail.allowed",
      };
    }

    // Normal case: not in cooldown, track repeated signals
    const repeated = state.lastGuardrailSignature === signal.signature;
    const nextCount = state.guardrailActionCount + 1;

    const cooldown = nextCount >= this.maxRepeatedActions;

    const nextState: GuardrailVibrationState = {
      guardrailActionCount: cooldown ? 0 : nextCount,
      lastGuardrailSignature: signal.signature,
      guardrailCooldownUntilMs: cooldown ? signal.observedAtMs + this.cooldownMs : null,
    };

    return {
      allowed: !cooldown,
      state: nextState,
      reasonCode: cooldown ? "guardrail.cooldown" : "guardrail.allowed",
    };
  }
}
