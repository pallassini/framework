import Hero from "./_components/hero";
import Meteors from "./_components/meteors";

export default function Home() {
  return (
    <div s="relative">
      <div s="fill overflow-hidden no-events z--1">
        <Meteors fill density={1.2} />
      </div>
      <Hero />
    </div>
  );
}
