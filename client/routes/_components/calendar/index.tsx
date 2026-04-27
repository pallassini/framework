import { For, state } from "client";
import Popmenu from "../../../_components/popmenu";

/** Mese 0 = gennaio. */
export const MONTHS_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
] as const;

/** Griglia tipo calendario: settimana da lunedì. */
export const WEEKDAYS_IT = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
] as const;

const year = state(new Date().getFullYear());
export default function Calendar() {
  return (
    <div s="des:(w-80% h-85) mob:(w-100% h-74) bg-secondary round-round mt-5 col minh-0 overflow-hidden">
      {/* HEADER */}
      <div s="row centerx children-center p-4">
        <Year />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// YEAR
// ───────────────────────────────────────────────────────────────────────────────
function Year() {
  const YEAR_MIN = 1990;
  const YEAR_MAX = 2060;

  function yearRowsAround(anchor: number, len = 9): number[] {
    let start = anchor - 1;
    if (start < YEAR_MIN) start = YEAR_MIN;
    if (start + (len - 1) > YEAR_MAX) start = YEAR_MAX - (len - 1);
    return Array.from({ length: len }, (_, i) => start + i);
  }

  const closePulse = state(0);

  return (
    <>
      <Popmenu
        mode="light"
        direction="bottom"
        collapsed={() => <t s="px-4 py-2 row text-3 font-6">{year}</t>}
        closePulse={() => closePulse()}
        extended={() => (
          <div s="p-4 col-3">
            <For each={yearRowsAround(year())}>
              {(y) => (
                <t
                  s={() =>
                    y === year()
                      ? "px-2 py-1 mx-1 my-1 row text-3 scale-105 font-6 bg-primary cursor-pointer round-10px "
                      : "px-2 py-1 mx-1 my-1 row text-3 cursor-pointer hover:(scale-105 bg-#a6a6a6) round-10px"
                  }
                  click={() => {
                    year(y);
                    closePulse(1);
                    setTimeout(() => closePulse(0), 100);
                  }}
                >
                  {y}
                </t>
              )}
            </For>
          </div>
        )}
      />
    </>
  );
}
