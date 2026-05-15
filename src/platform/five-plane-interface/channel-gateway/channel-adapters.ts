import type { GatewayDeliveryReceipt } from "./types.js";

export interface ChannelAdapter {
  readonly channelType: string;
  sendMessage(input: {
    targetId: string;
    externalTargetId: string | null;
    text: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayDeliveryReceipt>;
  supports(channel: string): boolean;
}

export class ChannelAdapterRegistry {
  private readonly adapters = new Map<string, ChannelAdapter>();

  public register(adapter: ChannelAdapter | { readonly channel: string }): void {
    const normalized = normalizeChannelAdapter(adapter);
    if (this.adapters.has(normalized.channelType)) {
      throw new Error(`channel_adapter.already_registered: ${normalized.channelType}`);
    }
    this.adapters.set(normalized.channelType, normalized);
  }

  public get(channel: string): ChannelAdapter | undefined {
    return this.adapters.get(channel);
  }

  public getChannelTypes(): string[] {
    return Array.from(this.adapters.keys());
  }

  public supports(channel: string): boolean {
    return this.adapters.has(channel);
  }

  public has(channel: string): boolean {
    return this.supports(channel);
  }

  public registeredChannels(): string[] {
    return this.getChannelTypes();
  }
}

function normalizeChannelAdapter(adapter: ChannelAdapter | { readonly channel: string }): ChannelAdapter {
  if ("channelType" in adapter) {
    return adapter;
  }
  const legacy = adapter as {
    readonly channel: string;
    send(input: { targetId: string; externalTargetId: string | null; text: string; metadata?: Record<string, unknown> }): Promise<GatewayDeliveryReceipt>;
  };
  return Object.assign(legacy, {
    channelType: legacy.channel,
    supports: (channel: string) => channel === legacy.channel,
    sendMessage: (input: {
      targetId: string;
      externalTargetId: string | null;
      text: string;
      metadata?: Record<string, unknown>;
    }) => legacy.send(input),
  }) as ChannelAdapter;
}

export function createDefaultChannelAdapterRegistry(): ChannelAdapterRegistry {
  const registry = new ChannelAdapterRegistry();
  registry.register({
    channelType: "telegram",
    supports: (channel) => channel === "telegram",
    async sendMessage(input) {
      return createAdapterPlaceholderReceipt("telegram", input.targetId, input.externalTargetId);
    },
  });
  registry.register({
    channelType: "slack",
    supports: (channel) => channel === "slack",
    async sendMessage(input) {
      return createAdapterPlaceholderReceipt("slack", input.targetId, input.externalTargetId);
    },
  });
  registry.register({
    channelType: "webhook",
    supports: (channel) => channel === "webhook",
    async sendMessage(input) {
      return createAdapterPlaceholderReceipt("webhook", input.targetId, input.externalTargetId);
    },
  });
  return registry;
}

function createAdapterPlaceholderReceipt(
  channel: string,
  targetId: string,
  externalTargetId: string | null,
): GatewayDeliveryReceipt {
  return {
    deliveredAt: new Date(0).toISOString(),
    channel,
    targetId,
    externalTargetId,
    requestUrl: "",
    responseStatus: 0,
    providerMessageId: null,
  };
}

export class TelegramChannelAdapter implements ChannelAdapter {
  public readonly channelType = "telegram";

  public constructor(
    private readonly sendFn: (
      targetId: string,
      externalTargetId: string | null,
      text: string,
    ) => Promise<GatewayDeliveryReceipt>,
  ) {}

  public supports(channel: string): boolean {
    return channel === "telegram";
  }

  public async sendMessage(input: {
    targetId: string;
    externalTargetId: string | null;
    text: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayDeliveryReceipt> {
    return this.sendFn(input.targetId, input.externalTargetId, input.text);
  }
}

export class SlackChannelAdapter implements ChannelAdapter {
  public readonly channelType = "slack";

  public constructor(
    private readonly sendFn: (
      targetId: string,
      externalTargetId: string | null,
      text: string,
    ) => Promise<GatewayDeliveryReceipt>,
  ) {}

  public supports(channel: string): boolean {
    return channel === "slack";
  }

  public async sendMessage(input: {
    targetId: string;
    externalTargetId: string | null;
    text: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayDeliveryReceipt> {
    return this.sendFn(input.targetId, input.externalTargetId, input.text);
  }
}

export class WebhookChannelAdapter implements ChannelAdapter {
  public readonly channelType = "webhook";

  public constructor(
    private readonly sendFn: (
      targetId: string,
      externalTargetId: string | null,
      text: string,
      metadata: Record<string, unknown>,
    ) => Promise<GatewayDeliveryReceipt>,
  ) {}

  public supports(channel: string): boolean {
    return channel === "webhook";
  }

  public async sendMessage(input: {
    targetId: string;
    externalTargetId: string | null;
    text: string;
    metadata?: Record<string, unknown>;
  }): Promise<GatewayDeliveryReceipt> {
    return this.sendFn(input.targetId, input.externalTargetId, input.text, input.metadata ?? {});
  }
}
