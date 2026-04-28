import { state, type server, watch, For } from "client";
import Popmenu from "../../_components/popmenu";

const data = state<server<"consumer">>(
	fetch("https://localhost:3000/_server/consumer", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ input: {} }),
	}).then((r) => r.json()),
);
watch(() => console.log(data()));

export default function Booker() {
  return (
    <>
      <div s="mt-20 ml-40">
        <Popmenu
          mode="light"
          direction="bottom"
          round={10}
          collapsed={() => <div s="px-4 py-3 round-8px text-3 font-6">Prenota</div>}
          extended={() => <>  </>}
        />
      </div>
    </>
  );
}
