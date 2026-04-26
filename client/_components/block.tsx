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
          "col w-100% round-round des:(p-4) mob:(p-3) centerx bg-secondary": true,
          ...s,
        },
      }}
      style={style as any}
    >
      <div
        s={{
          base: "font-6 text-6 row round-5px gapx-1.5 children-center ",
        }}
      >
        {iconName ? <icon name={iconName} size="7" stroke={2} s="text-primary" /> : null}
        <t>{title}</t>
        <div s="right">{actions}</div>
      </div>
      {children}
    </div>
  );
}
