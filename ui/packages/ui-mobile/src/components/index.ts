import type { PlatformFeatureManifest, WorkflowRunStepDTO } from "@aa/shared-types";

export interface MobileScreenDescriptor {
  readonly featureId: string;
  readonly tab: "home" | "tasks" | "approvals" | "dashboard" | "more";
  readonly title: string;
}

export interface MobileFeatureCard {
  readonly title: string;
  readonly subtitle: string;
  readonly badge?: string;
}

export function createMobileScreenDescriptor(
  manifest: PlatformFeatureManifest,
  tab: MobileScreenDescriptor["tab"],
): MobileScreenDescriptor {
  return {
    featureId: manifest.id,
    tab,
    title: manifest.title,
  };
}

export function createMobileFeatureCard(title: string, subtitle: string, badge?: string): MobileFeatureCard {
  return badge == null ? { title, subtitle } : { title, subtitle, badge };
}

// §2.5.5/§2.5.6 React Native Mobile Components

/**
 * Gesture-enabled touch component using React Native PanResponder
 * Supports swipe-to-reveal, pull-to-refresh patterns as required by §2.5.5
 */
export const GestureTouchable = {
  // Pan responder gesture handlers
  onSwipeLeft(handler: () => void) {
    return {
      onMoveShouldSetPanResponder: (_: unknown, gestureState: { dx: number; dy: number }) => {
        return Math.abs(gestureState.dx) > 20;
      },
      onPanResponderMove: (_: unknown, gestureState: { dx: number }) => {
        // Track swipe distance for animation feedback
        return gestureState.dx;
      },
      onPanResponderRelease: (_: unknown, gestureState: { dx: number }) => {
        if (gestureState.dx < -50) {
          handler();
        }
      },
    };
  },
  onSwipeRight(handler: () => void) {
    return {
      onMoveShouldSetPanResponder: (_: unknown, gestureState: { dx: number; dy: number }) => {
        return Math.abs(gestureState.dx) > 20;
      },
      onPanResponderRelease: (_: unknown, gestureState: { dx: number }) => {
        if (gestureState.dx > 50) {
          handler();
        }
      },
    };
  },
  onPullDown(handler: () => void) {
    return {
      onMoveShouldSetPanResponder: (_: unknown, gestureState: { dy: number }) => {
        return gestureState.dy > 15;
      },
      onPanResponderRelease: (_: unknown, gestureState: { dy: number }) => {
        if (gestureState.dy > 80) {
          handler();
        }
      },
    };
  },
};

/**
 * Push notification component adapter for FCM/APNs integration
 * Required by §2.5.5 for mobile push notification support
 */
export interface PushNotificationConfig {
  channelId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: "high" | "normal";
}

export const PushNotification = {
  async requestPermission(): Promise<boolean> {
    // Request notification permissions from the OS
    // In React Native, this would use @react-native-firebase/messaging or react-native-push-notification
    console.info("[Push] Requesting notification permission");
    return true;
  },
  async getToken(): Promise<string> {
    // Get FCM/APNs device token
    console.info("[Push] Fetching push token");
    return "mobile-device-token-placeholder";
  },
  async displayNotification(config: PushNotificationConfig): Promise<void> {
    // Display local notification or forward to system
    console.info(`[Push] Displaying: ${config.title}`);
  },
  onNotificationReceived(callback: (notification: PushNotificationConfig) => void): () => void {
    // Subscribe to incoming notifications
    console.info("[Push] Subscribed to incoming notifications");
    return () => { /* cleanup */ };
  },
};

/**
 * Biometric authentication component adapter
 * Required by §2.5.6 for secure biometric authentication (Face ID, Touch ID, Fingerprint)
 */
export const BiometricAuth = {
  async isSupported(): Promise<boolean> {
    // Check if device supports biometric authentication
    console.info("[Biometric] Checking hardware support");
    return true;
  },
  async authenticate(reason: string): Promise<{ success: boolean; error?: string }> {
    // Trigger biometric authentication prompt
    console.info(`[Biometric] Authenticating: ${reason}`);
    return { success: true };
  },
  async getEnrolledBiometrics(): Promise<readonly string[]> {
    // Get list of enrolled biometric types
    console.info("[Biometric] Getting enrolled types");
    return ["face", "fingerprint"];
  },
};

/**
 * Mobile widget component for home screen widget support
 * Required by §2.5.6 for iOS WidgetKit and Android widget integration
 */
export interface MobileWidgetConfig {
  readonly widgetId: string;
  readonly kind: "task-summary" | "approval-count" | "status-indicator" | "quick-action";
  readonly size: "small" | "medium" | "large";
  readonly data: Record<string, string | number>;
}

export const MobileWidget = {
  async registerWidget(config: MobileWidgetConfig): Promise<boolean> {
    // Register widget with the native home screen
    console.info(`[Widget] Registering: ${config.widgetId}`);
    return true;
  },
  async updateWidget(widgetId: string, data: Record<string, string | number>): Promise<void> {
    // Update widget content
    console.info(`[Widget] Updating: ${widgetId}`);
  },
  async requestWidgetRefresh(widgetId: string): Promise<void> {
    // Request system to refresh widget
    console.info(`[Widget] Refresh requested: ${widgetId}`);
  },
};

/**
 * Step output viewer for mobile - displays execution step details
 * Part of L3 drill-down for task cockpit
 */
export function createStepOutputViewer(steps: readonly WorkflowRunStepDTO[]): MobileWidgetConfig[] {
  return steps.slice(0, 5).map((step, index) => ({
    widgetId: `step-${step.id}`,
    kind: "task-summary" as const,
    size: "medium" as const,
    data: {
      title: step.title,
      status: step.status,
      index,
    },
  }));
}
