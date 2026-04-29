import { state } from "client";

export const next = state(false);
export const previous = state(false);
export default function Arrows() {
  return (
    <div>
      <icon show={previous} name="chevronLeft" size={5} stroke={3} s="text-background" />
      <icon show={next} name="chevronRight" size={5} stroke={3} s="text-background" />
    </div>
  );
}
