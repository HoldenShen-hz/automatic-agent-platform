import { createStore } from "zustand/vanilla";
import { withPersistDevtoolsDraft } from "./middleware";

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
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
          set((draft) => {
            draft.notifications = [newNotification, ...draft.notifications];
            draft.notificationLookup = {
              ...draft.notificationLookup,
              [newNotification.id]: newNotification,
            };
            draft.unreadCount += 1;
          });
        },
        markRead(id) {
          set((draft) => {
            const notification = draft.notificationLookup[id];
            if (notification == null || notification.read) {
              return;
            }
            notification.read = true;
            draft.notificationLookup = {
              ...draft.notificationLookup,
              [id]: notification,
            };
            draft.unreadCount = Math.max(0, draft.unreadCount - 1);
          });
        },
        markAllRead() {
          set((draft) => {
            for (const notification of draft.notifications) {
              notification.read = true;
            }
            draft.notificationLookup = Object.fromEntries(
              draft.notifications.map((notification) => [notification.id, notification]),
            );
            draft.unreadCount = 0;
          });
        },
        dismissNotification(id) {
          set((draft) => {
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
          set((draft) => {
            draft.notifications = [];
            draft.notificationLookup = {};
            draft.unreadCount = 0;
          });
        },
      }),
    ),
  );
}
