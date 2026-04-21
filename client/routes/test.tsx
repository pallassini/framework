import { state } from "client";

interface TestProps {
  collapsed: unknown;
  extended: unknown;
  duration: number;
  s: any;
  direction: "up" | "down" | "left" | "right";
}
export default function Test(props: TestProps) {
  const { collapsed, extended, duration, s, direction } = props;
  const open = state(false);
  return (
    <div
      s="absolute px-2 py-2 mt-30 ml-10 bg-#545454 round-20px "
      click={() => open(true)}
      clickout={() => open(false)}
    >
      <div show={() => !open()}>
        <icon name="plus" size="6" s="p-1 " stroke={3} />
      </div>

      <div show={open}>
        <div s="bg-#002fff w-20 h-20">
          <t>ciao</t>
          <t>ciao</t>
          <t>ciao</t>
        </div>
      </div>
    </div>
  );
}
