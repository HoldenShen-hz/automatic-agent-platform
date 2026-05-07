import { devtools, persist, type PersistOptions } from "zustand/middleware";
import type { StateCreator, StoreApi } from "zustand/vanilla";

type MutableDraft<T> =
  T extends (...args: never[]) => unknown ? T
    : T extends readonly (infer U)[] ? MutableDraft<U>[]
      : T extends object ? { -readonly [K in keyof T]: MutableDraft<T[K]> }
        : T;

type DraftUpdater<T> = (draft: MutableDraft<T>) => void;
type StateUpdater<T> = (state: T) => T | Partial<T> | void;
type DraftCapablePartial<T> = T | Partial<T> | DraftUpdater<T> | StateUpdater<T>;
type DraftSetState<T> = (partial: DraftCapablePartial<T>, replace?: boolean) => void;
type DraftStateCreator<T> = (set: DraftSetState<T>, get: () => T, api: StoreApi<T>) => T;

function cloneDraftValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneDraftValue(entry)) as T;
  }
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  if (value != null && typeof value === "object") {
    const clonedEntries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, cloneDraftValue(entry)]);
    return Object.fromEntries(clonedEntries) as T;
  }
  return value;
}

function withDraft<T>(initializer: DraftStateCreator<T>): StateCreator<T, [], []> {
  return (set, get, api) => initializer(
    ((partial: DraftCapablePartial<T>, replace?: boolean) => {
      if (typeof partial !== "function") {
        set(partial, replace);
        return;
      }

      set((currentState) => {
        const draft = cloneDraftValue(currentState);
        const result = (partial as DraftUpdater<T> | StateUpdater<T>)(draft);
        return result === undefined ? draft : result;
      }, replace);
    }) as typeof set,
    get,
    api,
  );
}

export function withPersistDevtoolsDraft<T>(
  name: string,
  initializer: DraftStateCreator<T>,
  persistOptions: Omit<PersistOptions<T>, "name"> = {},
): StateCreator<T, [], []> {
  return devtools(
    persist(withDraft(initializer), {
      ...persistOptions,
      name,
    }),
    { name },
  );
}
