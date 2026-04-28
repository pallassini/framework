import { mount, state, type server, watch, For, auth } from "client";
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
      <div s="mt-20 ml-50">
        <Popmenu
          mode="light"
          direction="bottom"
          round={10}
          collapsed={() => <div s="px-4 py-3 round-8px text-3 font-6">Prenota</div>}
          extended={() => (
            <>
              <div s="p-4 des:(w-40) col ">
                <t s="text-6 font-6 centerx row">{data.username}</t>
                {/* CATEGORIES */}
                <div s="mt-4 gap-4 col">
                  <For each={() => data()?.itemCategories ?? []}>
                    {(c) => (
                      <div s="b-2 b-secondary round-8px p-4">
                        <div s=" text-6 font-6 border-b-1px border-tertiary text-secondary">
                          {c.name}
                        </div>
                        {/* ITEMS */}
                        <div s="col-3 centerx children-center mt-3">
                          <For
                            each={() =>
                              data()?.services?.filter((s) => s.categoryId === c.id) ?? []
                            }
                          >
                            {(s) => (
                              <div s=" col centerx children-left round-10px bg-secondary des:(w-10) px-4 py-4 text-#fff gap-2">
                                <t s="text-3 font-6 mb-2 centerx row">{s.name}</t>
                                <div s='row children-center gap-1'>
                                  <icon name="clock" size={6} stroke={2} s="text-#fff" />
                                <t s="text-2 font-5" show={s.duration}>{s.duration} min</t>
                                </div>
                               <div s='row children-center gap-1'>
                                <icon name="euro" size={6} stroke={2} s="text-#fff" />
                                <t s="text-2 font-5" show={s.price}>{s.price}</t>
                               </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </>
          )}
        />
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// CONFIGURAZIONE EMBED DEL WIDGET
// ───────────────────────────────────────────────────────────────────────────────
if (import.meta.env.VITE_BOOKER_EMBED) {
  void import("../../index.css?inline").then(({ default: bookerCss }) => {
    const id = "fw-booker-widget-styles";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = bookerCss;
      document.head.appendChild(style);
    }
    function mountWidgets(): void {
      const nodes = document.querySelectorAll("[data-booking-widget]");
      for (let i = 0; i < nodes.length; i++) {
        mount(Booker(), nodes[i] as HTMLElement);
      }
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => mountWidgets());
    } else {
      mountWidgets();
    }
  });
}
