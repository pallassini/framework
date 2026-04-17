import FlowAgency from "./_components/flowAgency";
import Problem from "./_components/problem";
import { state, watch } from "client";
import Projects from "./_components/projects";

const PROBLEM_DELAY_MS = 2200;

export default function Home() {
  const showProblem = state(false);

  watch(() => {
    const id = window.setTimeout(() => showProblem(true), PROBLEM_DELAY_MS);
    watch.onCleanup(() => clearTimeout(id));
  });

  return (
    <>
      <FlowAgency />
      <div show={true} s={{ des: "mt-15vh", mob: "mt-5vh" }}>
        <Problem />
      </div>
      <div s={{ des: "mt-20vh mb-20vh", mob: "mt-10vh mb-10vh" }}>
        <Projects />
      </div>
    </>
  );
}
