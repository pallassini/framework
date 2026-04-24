import { Icon } from "../../core/client/runtime/tag/tags/icon";

type CardProps = {
  title?: string;
  icon?: Icon;
  children?: unknown;
  s?: any;
  /** Stile inline sul contenitore esterno (oltre a `s`). */
  style?: unknown;
  actions?: unknown;
};

export default function Block({ title, icon: iconName, children, s, style, actions }: CardProps) {
  return (
    <div
      s={{
        base: {
          "col w-100% round-round p-5 centerx bg-secondary": true,
          ...s,
        },
      }}
      style={style as any}
    >
      <div
        s={{
          base: "font-6 text-6 row round-5px gapx-2 children-center ",
        }}
      >
        <icon name={iconName as Icon} size="7" stroke={2.5} s="text-primary" />
        <t>{title}</t>
        <div s="right">{actions}</div>
      </div>
      {children}
    </div>
  );
}
