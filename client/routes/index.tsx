import FlowAgency from "./_components/flowAgency";
import Problem from "./_components/problem";
import { state, watch } from "client";

const PROBLEM_DELAY_MS = 0;

export default function Home() {
  const showProblem = state(false);

  watch(() => {
    const id = window.setTimeout(() => showProblem(true), PROBLEM_DELAY_MS);
    watch.onCleanup(() => clearTimeout(id));
  });

  return (
    <>
      <FlowAgency />
      <div show={showProblem} s="mt-30vh mb-20vh">
        <Problem />
      </div>
    </>
  );
}
