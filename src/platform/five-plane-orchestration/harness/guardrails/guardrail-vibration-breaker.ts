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
    if (state.guardrailCooldownUntilMs != null && signal.observedAtMs < state.guardrailCooldownUntilMs) {
      return {
        allowed: false,
        state,
        reasonCode: "guardrail.cooldown",
      };
    }

    const repeated = state.lastGuardrailSignature === signal.signature;
    const nextCount = repeated ? state.guardrailActionCount + 1 : 1;
    // R32-07 fix: off-by-one error - use >= so blocking occurs at maxRepeatedActions boundary.
    // With >: nextCount=2, maxRepeat=1 → blocked (allows maxRepeat+1=2 actions).
    // With >=: nextCount=2, maxRepeat=1 → blocked (allows maxRepeat=1 actions).
    // For maxRepeat=0 with >=: nextCount=1 >= 0 → blocked immediately (allows 0 actions).
    const cooldown = nextCount >= this.maxRepeatedActions;
    const nextState: GuardrailVibrationState = {
      guardrailActionCount: nextCount,
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
