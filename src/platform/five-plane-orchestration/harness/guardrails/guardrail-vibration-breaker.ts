export interface GuardrailActionSignal {
  readonly runId: string;
  readonly signature: string;
  readonly observedAtMs: number;
}

export interface GuardrailVibrationState {
  readonly guardrailActionCount: number;
  readonly lastGuardrailSignature: string | null;
  readonly guardrailCooldownUntilMs: number | null;
  readonly recentSignals?: readonly Pick<GuardrailActionSignal, "signature" | "observedAtMs">[];
}

export interface GuardrailVibrationDecision {
  readonly allowed: boolean;
  readonly state: GuardrailVibrationState;
  readonly reasonCode: "guardrail.allowed" | "guardrail.cooldown";
}

export class GuardrailVibrationBreaker {
  public constructor(
    private readonly maxRepeatedActions = 3,
    private readonly cooldownMs = 30_000,
    private readonly observationWindowMs = 30_000,
  ) {}

  public evaluate(signal: GuardrailActionSignal, state: GuardrailVibrationState): GuardrailVibrationDecision {
    if (signal.signature === "proceed") {
      return {
        allowed: true,
        state: {
          guardrailActionCount: 0,
          lastGuardrailSignature: null,
          guardrailCooldownUntilMs: null,
          recentSignals: [],
        },
        reasonCode: "guardrail.allowed",
      };
    }

    const cooldownExpiry = state.guardrailCooldownUntilMs;

    if (cooldownExpiry != null && signal.observedAtMs < cooldownExpiry) {
      return {
        allowed: false,
        state,
        reasonCode: "guardrail.cooldown",
      };
    }

    const activeSignals = (
      cooldownExpiry != null && signal.observedAtMs >= cooldownExpiry
        ? []
        : state.recentSignals != null
          ? [...state.recentSignals]
          : Array.from({ length: state.guardrailActionCount }, () => ({
              signature: state.lastGuardrailSignature ?? signal.signature,
              observedAtMs: signal.observedAtMs,
            }))
    ).filter((entry) => entry.observedAtMs >= signal.observedAtMs - this.observationWindowMs);
    const nextSignals = [...activeSignals, { signature: signal.signature, observedAtMs: signal.observedAtMs }];
    const nextCount = nextSignals.length;
    const cooldown = nextCount > this.maxRepeatedActions;

    const nextState: GuardrailVibrationState = {
      guardrailActionCount: cooldown ? 0 : nextCount,
      lastGuardrailSignature: signal.signature,
      guardrailCooldownUntilMs: cooldown ? signal.observedAtMs + this.cooldownMs : null,
      recentSignals: cooldown ? [] : nextSignals,
    };

    return {
      allowed: !cooldown,
      state: nextState,
      reasonCode: cooldown ? "guardrail.cooldown" : "guardrail.allowed",
    };
  }
}
