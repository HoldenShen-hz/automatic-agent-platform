import { devtools, persist, type PersistOptions } from "zustand/middleware";
import type { StateCreator, StoreApi } from "zustand/vanilla";

type MutableDraft<T> =
  T extends (...args: never[]) => unknown ? T
    : T extends readonly (infer U)[] ? MutableDraft<U>[]
      : T extends object ? { -readonly [K in keyof T]: MutableDraft<T[K]> }
        : T;

type DraftUpdater<T> = (draft: MutableDraft<T>) => void;
type StateUpdater<T> = (state: MutableDraft<T>) => T | Partial<T> | void;
type DraftSetState<T> = {
  (partial: T | Partial<T>, replace?: boolean): void;
  (partial: DraftUpdater<T> | StateUpdater<T>, replace?: boolean): void;
};
type DraftStateCreator<T> = (set: DraftSetState<T>, get: () => T, api: StoreApi<T>) => T;

function cloneDraftValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall through when structured cloning cannot represent the current value.
    }
  }
  if (Array.isArray(value)) {
    return value.map((entry) => cloneDraftValue(entry)) as T;
  }
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  if (value instanceof Map) {
    return new Map(Array.from(value.entries(), ([key, entry]) => [cloneDraftValue(key), cloneDraftValue(entry)])) as T;
  }
  if (value instanceof Set) {
    return new Set(Array.from(value.values(), (entry) => cloneDraftValue(entry))) as T;
  }
  if (value != null && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    const clone = Object.create(prototype) as Record<PropertyKey, unknown>;
    for (const key of Reflect.ownKeys(value as object)) {
      clone[key] = cloneDraftValue(Reflect.get(value as object, key));
    }
    return clone as T;
  }
  return value;
}

function withDraft<T>(initializer: DraftStateCreator<T>): StateCreator<T, [], []> {
  return (set, get, api) => {
    const draftSet: DraftSetState<T> = (partial, replace) => {
      const storeSet = set as StoreApi<T>["setState"];
      if (typeof partial !== "function") {
        (storeSet as (...args: unknown[]) => void)(partial, replace);
        return;
      }

      (storeSet as (...args: unknown[]) => void)((currentState: T) => {
        const draft = cloneDraftValue(currentState) as MutableDraft<T>;
        const result = (partial as DraftUpdater<T> | StateUpdater<T>)(draft);
        return (result === undefined ? draft : result) as T | Partial<T>;
      }, replace);
    };
    return initializer(draftSet, get, api);
  };
}

export function withPersistDevtoolsDraft<T>(
  name: string,
  initializer: DraftStateCreator<T>,
  persistOptions: Omit<PersistOptions<T>, "name"> = {},
): StateCreator<T, [], []> {
  const version = persistOptions.version ?? 1;
  const migrate = persistOptions.migrate ?? ((persistedState: unknown) => persistedState as T);
  return devtools(
    persist(withDraft(initializer), {
      ...persistOptions,
      version,
      migrate,
      name,
    }),
    { name },
  ) as unknown as StateCreator<T, [], []>;
}
