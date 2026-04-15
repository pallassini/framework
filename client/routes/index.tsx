import Hero from "./_components/hero";
import Meteors from "./_components/meteors";
import Problem from "./_components/problem";
import Real from "./_components/problem/real";

export default function Home() {
  return (
    <div s="relative">
      <div s="fill overflow-hidden no-events z--1">
        <Meteors fill density={1} />
      </div>
      <Hero />
      <Real />
      <div s='mt-30vh'>
      <Problem />
      </div>
    </div>
  );
}
