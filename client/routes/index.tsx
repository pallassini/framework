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
      <div show={showProblem} s={{ des: "mt-15vh mb-20vh", mob: "mt-5vh mb-10vh" }}>
        <Problem />
      </div>
    </>
  );
}
