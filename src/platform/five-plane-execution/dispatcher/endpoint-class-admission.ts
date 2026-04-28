export type EndpointClass =
  | "read_query"
  | "create_run"
  | "control_command"
  | "event_ingest"
  | "websocket_stream";

export interface EndpointClassPolicy {
  readonly endpointClass: EndpointClass;
  readonly maxQueueDepth: number;
  readonly rateLimitPerMinute: number;
}

export interface EndpointClassSnapshot {
  readonly endpointClass: EndpointClass;
  readonly queueDepthBefore: number;
  readonly requestsInCurrentMinute: number;
}

export interface EndpointClassAdmissionDecision {
  readonly accepted: boolean;
  readonly reasonCode:
    | "endpoint_class.accepted"
    | "endpoint_class.queue_depth_exceeded"
    | "endpoint_class.rate_limit_exceeded";
  readonly endpointClass: EndpointClass;
  readonly queueDepthBefore: number;
  readonly maxQueueDepth: number;
  readonly requestsInCurrentMinute: number;
  readonly rateLimitPerMinute: number;
}

export class EndpointClassAdmissionController {
  private readonly policies: ReadonlyMap<EndpointClass, EndpointClassPolicy>;

  public constructor(policies: readonly EndpointClassPolicy[]) {
    this.policies = new Map(policies.map((policy) => [policy.endpointClass, policy]));
  }

  public evaluate(snapshot: EndpointClassSnapshot): EndpointClassAdmissionDecision {
    const policy = this.policies.get(snapshot.endpointClass);
    if (policy == null) {
      throw new Error(`endpoint_class.policy_missing:${snapshot.endpointClass}`);
    }

    if (snapshot.queueDepthBefore >= policy.maxQueueDepth) {
      return this.decision(snapshot, policy, false, "endpoint_class.queue_depth_exceeded");
    }

    if (snapshot.requestsInCurrentMinute >= policy.rateLimitPerMinute) {
      return this.decision(snapshot, policy, false, "endpoint_class.rate_limit_exceeded");
    }

    return this.decision(snapshot, policy, true, "endpoint_class.accepted");
  }

  private decision(
    snapshot: EndpointClassSnapshot,
    policy: EndpointClassPolicy,
    accepted: boolean,
    reasonCode: EndpointClassAdmissionDecision["reasonCode"],
  ): EndpointClassAdmissionDecision {
    return {
      accepted,
      reasonCode,
      endpointClass: snapshot.endpointClass,
      queueDepthBefore: snapshot.queueDepthBefore,
      maxQueueDepth: policy.maxQueueDepth,
      requestsInCurrentMinute: snapshot.requestsInCurrentMinute,
      rateLimitPerMinute: policy.rateLimitPerMinute,
    };
  }
}
