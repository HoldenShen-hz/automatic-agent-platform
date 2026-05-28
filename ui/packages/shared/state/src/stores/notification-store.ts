import { generateStableId } from "@aa/shared-api-client";
import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";

type NotificationStoreDraft = {
  -readonly [K in keyof NotificationStoreState]:
    NotificationStoreState[K] extends readonly (infer U)[] ? U[]
      : NotificationStoreState[K];
};

export type NotificationKind = "info" | "success" | "warning" | "error";

export interface Notification {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly message?: string;
  readonly createdAt: string;
  readonly read: boolean;
}

export interface NotificationStoreState {
  readonly notifications: readonly Notification[];
  readonly notificationLookup: Readonly<Record<string, Notification>>;
  readonly unreadCount: number;
  addNotification(notification: Omit<Notification, "id" | "createdAt" | "read">): void;
  markRead(id: string): void;
  markAllRead(): void;
  dismissNotification(id: string): void;
  clearAll(): void;
}

function generateId(): string {
  return generateStableId("notif-");
}

export function createNotificationStore() {
  return createStore<NotificationStoreState>()(
    withPersistDevtoolsDraft(
      "aa-notification-store",
      (set) => ({
        notifications: [],
        notificationLookup: {},
        unreadCount: 0,
        addNotification(notification) {
          const newNotification: Notification = {
            ...notification,
            id: generateId(),
            createdAt: new Date().toISOString(),
            read: false,
          };
          set((draft: NotificationStoreDraft) => {
            draft.notifications = [newNotification, ...draft.notifications];
            draft.notificationLookup = {
              ...draft.notificationLookup,
              [newNotification.id]: newNotification,
            };
            draft.unreadCount += 1;
          });
        },
        markRead(id) {
          set((draft: NotificationStoreDraft) => {
            const notification = draft.notificationLookup[id];
            if (notification == null || notification.read) {
              return;
            }
            const nextNotification: Notification = {
              ...notification,
              read: true,
            };
            draft.notifications = draft.notifications.map((entry) => entry.id === id ? nextNotification : entry);
            draft.notificationLookup = {
              ...draft.notificationLookup,
              [id]: nextNotification,
            };
            draft.unreadCount = Math.max(0, draft.unreadCount - 1);
          });
        },
        markAllRead() {
          set((draft: NotificationStoreDraft) => {
            draft.notifications = draft.notifications.map((notification) => ({
              ...notification,
              read: true,
            }));
            draft.notificationLookup = Object.fromEntries(
              draft.notifications.map((notification) => [notification.id, notification]),
            );
            draft.unreadCount = 0;
          });
        },
        dismissNotification(id) {
          set((draft: NotificationStoreDraft) => {
            const notification = draft.notificationLookup[id];
            draft.notifications = draft.notifications.filter((entry) => entry.id !== id);
            const nextLookup = { ...draft.notificationLookup };
            delete nextLookup[id];
            draft.notificationLookup = nextLookup;
            if (notification != null && !notification.read) {
              draft.unreadCount = Math.max(0, draft.unreadCount - 1);
            }
          });
        },
        clearAll() {
          set((draft: NotificationStoreDraft) => {
            draft.notifications = [];
            draft.notificationLookup = {};
            draft.unreadCount = 0;
          });
        },
      }),
    ),
  );
}
