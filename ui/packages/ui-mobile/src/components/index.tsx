import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type TouchableOpacityProps,
} from "react-native";

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
  manifest: { id: string; title: string },
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

interface ButtonProps extends TouchableOpacityProps {
  readonly variant?: "primary" | "secondary" | "danger";
  readonly size?: "small" | "medium" | "large";
  readonly children: React.ReactNode;
}

export function Button({ variant = "primary", size = "medium", style, children, ...props }: ButtonProps): React.JSX.Element {
  const buttonStyles: ViewStyle[] = [styles.button, styles[`button_${variant}`], styles[`button_${size}`]];
  const textStyles: TextStyle[] = [styles.buttonText, styles[`buttonText_${variant}`], styles[`buttonText_${size}`]];

  return (
    <TouchableOpacity style={[buttonStyles, style]} {...props}>
      <Text style={textStyles}>{children}</Text>
    </TouchableOpacity>
  );
}

interface CardProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly badge?: string;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
}

export function Card({ title, subtitle, badge, onPress, style }: CardProps): React.JSX.Element {
  const content = (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {badge != null && <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>}
      </View>
      {subtitle != null && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
    </View>
  );

  if (onPress != null) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

interface TabBarProps {
  readonly tabs: readonly { key: string; title: string; badge?: string }[];
  readonly activeTab: string;
  readonly onTabChange: (key: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps): React.JSX.Element {
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          onPress={() => onTabChange(tab.key)}
        >
          <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.title}</Text>
          {tab.badge != null && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{tab.badge}</Text></View>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface ListItemProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly rightText?: string;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
}

export function ListItem({ title, subtitle, rightText, onPress, style }: ListItemProps): React.JSX.Element {
  const content = (
    <View style={[styles.listItem, style]}>
      <View style={styles.listItemLeft}>
        <Text style={styles.listItemTitle}>{title}</Text>
        {subtitle != null && <Text style={styles.listItemSubtitle}>{subtitle}</Text>}
      </View>
      {rightText != null && <Text style={styles.listItemRight}>{rightText}</Text>}
    </View>
  );

  if (onPress != null) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

interface HeaderProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly leftAction?: { label: string; onPress: () => void };
  readonly rightAction?: { label: string; onPress: () => void };
}

export function Header({ title, subtitle, leftAction, rightAction }: HeaderProps): React.JSX.Element {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {leftAction != null && (
          <TouchableOpacity onPress={leftAction.onPress}>
            <Text style={styles.headerAction}>{leftAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle != null && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>
      <View style={styles.headerRight}>
        {rightAction != null && (
          <TouchableOpacity onPress={rightAction.onPress}>
            <Text style={styles.headerAction}>{rightAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  button_primary: {
    backgroundColor: "#0066CC",
  },
  button_secondary: {
    backgroundColor: "#F0F0F0",
  },
  button_danger: {
    backgroundColor: "#CC0000",
  },
  button_small: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  button_medium: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  button_large: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  buttonText: {
    fontWeight: "600",
  },
  buttonText_primary: {
    color: "#FFFFFF",
  },
  buttonText_secondary: {
    color: "#333333",
  },
  buttonText_danger: {
    color: "#FFFFFF",
  },
  buttonText_small: {
    fontSize: 12,
  },
  buttonText_medium: {
    fontSize: 14,
  },
  buttonText_large: {
    fontSize: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#666666",
    marginTop: 4,
  },
  badge: {
    backgroundColor: "#0066CC",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    paddingBottom: 20,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#0066CC",
  },
  tabText: {
    fontSize: 14,
    color: "#666666",
  },
  tabTextActive: {
    color: "#0066CC",
    fontWeight: "600",
  },
  tabBadge: {
    position: "absolute",
    top: 2,
    right: "20%",
    backgroundColor: "#CC0000",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tabBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  listItemLeft: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    color: "#333333",
  },
  listItemSubtitle: {
    fontSize: 14,
    color: "#666666",
    marginTop: 2,
  },
  listItemRight: {
    fontSize: 14,
    color: "#999999",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  headerLeft: {
    width: 60,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerRight: {
    width: 60,
    alignItems: "flex-end",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333333",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#666666",
    marginTop: 2,
  },
  headerAction: {
    fontSize: 16,
    color: "#0066CC",
  },
});
