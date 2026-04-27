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


export default function Calendar() {
  return (
    <div s="des:(w-80% h-85) mob:(w-100% h-74) bg-secondary round-round mt-5 col minh-0 overflow-hidden">
      {/* HEADER */}
      <div s="row centerx children-center p-4">
        <YearMonth />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// YEAR & MONTH
// ───────────────────────────────────────────────────────────────────────────────
const year = state(new Date().getFullYear());
const month = state(new Date().getMonth());
function YearMonth() {

  const closePulse = state(0);

  return (
    <>
      <Popmenu
        mode="light"
        direction="bottom"
        collapsed={() => <t s="px-4 py-2 row text-3 font-6">{()=>MONTHS_IT[month]} {year}</t>}
        closePulse={() => closePulse()}
        extended={() => (
          <div s="p-4 col-3 col children-centerx gap-2">
            <div s="row centerx gap-2 children-center">
                <icon size="6" name="chevronLeft" stroke="3" s="hover:(bg-#a6a6a6 scale-120 ) px-2 py-1 round-10px" click={() => year(year() - 1)}/>
                <t s="text-5 font-6">{year}</t>
                <icon size="6" name="chevronRight" stroke="3" s="hover:(bg-#a6a6a6 scale-120 ) px-2 py-1 round-10px" click={() => year(year() + 1)}/>
            </div>
         <div s='col-4'>
            <For each={MONTHS_IT}>
              {(y) => (
                <t
                  s={() =>
                    y === MONTHS_IT[month]
                      ? "px-2 py-2  row text-3 font-6 bg-primary cursor-pointer round-10px "
                      : "px-2 py-2 row text-3 font-6 cursor-pointer hover:(scale-105 bg-#a6a6a6) round-10px"
                  }
                  click={() => {
                    month(MONTHS_IT.indexOf(y));
                    closePulse(1);
                    setTimeout(() => closePulse(0), 100);
                  }}
                >
                  {y}
                </t>
              )}
            </For>
         </div>
          </div>
        )}
      />
    </>
  );
}

