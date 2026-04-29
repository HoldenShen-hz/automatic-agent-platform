import { createStore } from "zustand/vanilla";

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
  return createStore<NotificationStoreState>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    addNotification(notification) {
      const newNotification: Notification = {
        ...notification,
        id: generateId(),
        createdAt: new Date().toISOString(),
        read: false,
      };
      set((state) => ({
        notifications: [newNotification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      }));
    },
    markRead(id) {
      set((state) => {
        const notification = state.notifications.find((n) => n.id === id);
        if (!notification || notification.read) {
          return state;
        }
        return {
          notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
          unreadCount: Math.max(0, state.unreadCount - 1),
        };
      });
    },
    markAllRead() {
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    },
    dismissNotification(id) {
      set((state) => {
        const notification = state.notifications.find((n) => n.id === id);
        const newNotifications = state.notifications.filter((n) => n.id !== id);
        return {
          notifications: newNotifications,
          unreadCount: notification && !notification.read ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
        };
      });
    },
    clearAll() {
      set({ notifications: [], unreadCount: 0 });
    },
  }));
}
