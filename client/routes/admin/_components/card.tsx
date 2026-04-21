import { Icon } from "../../../../core/client/runtime/tag/tags/icon";

type CardProps = {
  title?: string;
  icon?: Icon;
  children?: unknown;
  s?: any;
  actions?: unknown;
};

export default function Card({ title, icon: iconName, children, s, actions }: CardProps) {
  return (
    <div
      s={{
        base: {
          "col w-100% round-round p-5 centerx bg-secondary": true,
          ...s,
        },
      }}
    >
      <div
        s={{
          des: "font-6 text-6 row round-5px  gapx-2 children-center",
        }}
      >
        <icon name={iconName} stroke={2.5} />
        <t>{title}</t>
        <div s="right">{actions}</div>
      </div>
      {children}
    </div>
  );
}
