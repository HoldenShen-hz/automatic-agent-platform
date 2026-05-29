import type { ButtonHTMLAttributes, CSSProperties, PropsWithChildren, ReactElement } from "react";

type NativeStyle = Record<string, unknown>;

export type ViewStyle = NativeStyle;
export type TextStyle = NativeStyle;
type StyleValue = NativeStyle | false | undefined;
type StyleInput = StyleValue | readonly StyleValue[];

export interface TouchableOpacityProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  readonly style?: StyleInput;
  readonly onPress?: () => void;
  readonly activeOpacity?: number;
}

function mergeStyle(style: StyleInput): CSSProperties | undefined {
  if (style == null) {
    return undefined;
  }
  if (Array.isArray(style)) {
    return style.reduce<CSSProperties>((merged, item) => item == null || item === false ? merged : { ...merged, ...(item as CSSProperties) }, {});
  }
  if (style === false) {
    return undefined;
  }
  return style as CSSProperties;
}

export function View({ children, style }: PropsWithChildren<{ style?: StyleInput }>): ReactElement {
  return <div style={mergeStyle(style)}>{children}</div>;
}

export function Text({ children, style }: PropsWithChildren<{ style?: StyleInput }>): ReactElement {
  return <span style={mergeStyle(style)}>{children}</span>;
}

export function TouchableOpacity(
  { children, style, onPress, activeOpacity: _activeOpacity, ...props }: PropsWithChildren<TouchableOpacityProps>,
): ReactElement {
  return (
    <button
      {...props}
      onClick={onPress ?? props.onClick}
      style={{
        background: "transparent",
        border: 0,
        padding: 0,
        cursor: "pointer",
        ...mergeStyle(style),
      }}
      type={props.type ?? "button"}
    >
      {children}
    </button>
  );
}

export const StyleSheet = {
  create<T extends Record<string, NativeStyle>>(styles: T): T {
    return styles;
  },
};

export const Platform: { readonly OS: "android" | "ios" | "web" } = {
  OS: "web",
};
