import { InternalAppError } from "../../contracts/errors.js";

export interface GlobalSingletonSlot<T> {
  instance: T | null;
  initializing: boolean;
  configurationFingerprint: string | null;
}

export function createGlobalSingletonSlot<T>(): GlobalSingletonSlot<T> {
  return {
    instance: null,
    initializing: false,
    configurationFingerprint: null,
  };
}

export function getOrCreateGlobalSingleton<T>(
  slot: GlobalSingletonSlot<T>,
  factory: () => T,
  options: {
    name: string;
    configurationFingerprint?: string | null;
  },
): T {
  const requestedFingerprint = options.configurationFingerprint ?? null;
  if (slot.instance != null) {
    assertSingletonConfigurationStable(slot, options.name, requestedFingerprint);
    return slot.instance;
  }
  if (slot.initializing) {
    throw new InternalAppError(
      "global_singleton.initialization_in_progress",
      `global_singleton.initialization_in_progress:${options.name}`,
      {
        source: "internal",
        details: { name: options.name },
      },
    );
  }
  slot.initializing = true;
  try {
    const instance = factory();
    slot.instance = instance;
    slot.configurationFingerprint = requestedFingerprint;
    return instance;
  } finally {
    slot.initializing = false;
  }
}

export async function getOrCreateGlobalSingletonAsync<T>(
  slot: GlobalSingletonSlot<T>,
  factory: () => Promise<T>,
  options: {
    name: string;
    configurationFingerprint?: string | null;
  },
): Promise<T> {
  const requestedFingerprint = options.configurationFingerprint ?? null;
  if (slot.instance != null) {
    assertSingletonConfigurationStable(slot, options.name, requestedFingerprint);
    return slot.instance;
  }
  if (slot.initializing) {
    throw new InternalAppError(
      "global_singleton.initialization_in_progress",
      `global_singleton.initialization_in_progress:${options.name}`,
      {
        source: "internal",
        details: { name: options.name },
      },
    );
  }
  slot.initializing = true;
  try {
    const instance = await factory();
    slot.instance = instance;
    slot.configurationFingerprint = requestedFingerprint;
    return instance;
  } finally {
    slot.initializing = false;
  }
}

export function resetGlobalSingleton<T>(
  slot: GlobalSingletonSlot<T>,
  options?: {
    beforeReset?: (instance: T) => void;
  },
): void {
  if (slot.instance != null) {
    options?.beforeReset?.(slot.instance);
  }
  slot.instance = null;
  slot.initializing = false;
  slot.configurationFingerprint = null;
}

function assertSingletonConfigurationStable<T>(
  slot: GlobalSingletonSlot<T>,
  name: string,
  requestedFingerprint: string | null,
): void {
  if (slot.configurationFingerprint == null || requestedFingerprint == null) {
    return;
  }
  if (slot.configurationFingerprint === requestedFingerprint) {
    return;
  }
  throw new InternalAppError(
    "global_singleton.configuration_drift",
    `global_singleton.configuration_drift:${name}`,
    {
      source: "internal",
      details: {
        name,
        existingConfigurationFingerprint: slot.configurationFingerprint,
        requestedConfigurationFingerprint: requestedFingerprint,
      },
    },
  );
}
