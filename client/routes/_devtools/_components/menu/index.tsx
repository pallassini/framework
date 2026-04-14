import { For, persistState, styleEq } from "client";

const TABS = [
  { id: "db", label: "DB" },

  { id: "state", label: "STATE" },
] as const;

export default function MenuDevtools() {
  return (
    <>
      <div s="row gapx-2vw center bg-#1865c2 p-2 font-6">
        <For each={TABS}>
          {(tab) => (
            <div
              click={() => persistState.devtools.menu(tab.id)}
              s={{
                base: {
                  "px-4 py-2 round-10px": true,
                  "bg-#313131": styleEq(persistState.devtools.menu, tab.id),
                },
                mob: {},
                des: {},
              }}
            >
              {tab.label}
            </div>
          )}
        </For>
      </div>

      
    </>
  );
}
