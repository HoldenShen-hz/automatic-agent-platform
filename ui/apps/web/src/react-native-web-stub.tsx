import type { ButtonHTMLAttributes, CSSProperties, PropsWithChildren, ReactElement } from "react";

type StyleInput = CSSProperties | readonly CSSProperties[] | undefined;

function mergeStyle(style: StyleInput): CSSProperties | undefined {
  if (style == null) {
    return undefined;
  }
  if (Array.isArray(style)) {
    return style.reduce<CSSProperties>((merged, item) => ({ ...merged, ...item }), {});
  }
  return style;
}

export function View({ children, style }: PropsWithChildren<{ style?: StyleInput }>): ReactElement {
  return <div style={mergeStyle(style)}>{children}</div>;
}

export function Text({ children, style }: PropsWithChildren<{ style?: StyleInput }>): ReactElement {
  return <span style={mergeStyle(style)}>{children}</span>;
}

export function TouchableOpacity(
  { children, style, onPress, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { style?: StyleInput; onPress?: () => void }>,
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
  create<T extends Record<string, CSSProperties>>(styles: T): T {
    return styles;
  },
};
