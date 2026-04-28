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
      <div s="row centerx children-center p-4 w-100% relative">
        <div s="center">
          <YearMonth />
        </div>
        <div s="absolute right m-4">
          <View />
        </div>
      </div>
      <div s="centerx mt-4">
        <DaysSwitcher />
      </div>
      <div s="w-100% des:(p-4) mob:(p-0) scrolly">
        <Days />
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
        collapsed={() => (
          <t s="px-5 py-3 row text-3 font-6">
            {() => MONTHS_IT[month]} {year}
          </t>
        )}
        closePulse={() => closePulse()}
        extended={() => (
          <div s="p-4 col-3 col children-centerx gap-2">
            <div s="row centerx gap-2 children-center">
              <icon
                size="6"
                name="chevronLeft"
                stroke="3"
                s="hover:(bg-#a6a6a6 scale-120 ) px-2 py-1 round-10px"
                click={() => year(year() - 1)}
              />
              <t s="text-5 font-6">{year}</t>
              <icon
                size="6"
                name="chevronRight"
                stroke="3"
                s="hover:(bg-#a6a6a6 scale-120 ) px-2 py-1 round-10px"
                click={() => year(year() + 1)}
              />
            </div>
            <div s="col-4">
              <For each={MONTHS_IT}>
                {(y) => (
                  <t
                    s={() =>
                      y === MONTHS_IT[month]
                        ? "px-2 py-2  row text-3 font-6 bg-primary cursor-pointer round-10px "
                        : "px-2 py-2 row text-3 font-6 cursor-pointer hover:(scale-105 bg-#a6a6a6) round-10px"
                    }
                    click={() => {
                      closePulse(1);
                      setTimeout(() => closePulse(0), 100);
                      setTimeout(() => month(MONTHS_IT.indexOf(y)), 450);
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

// ───────────────────────────────────────────────────────────────────────────────
// VIEW
// ───────────────────────────────────────────────────────────────────────────────
const VIEWS = ["Settimana", "Mese", "3 Mesi", "Anno"];
const view = state(VIEWS[1]);
const collapsedView = state(VIEWS[1]);
function View() {
  const closePulse = state(0);
  return (
    <>
      <Popmenu
        mode="light"
        direction="bottom"
        collapsed={() => <t s="px-5 py-3 row text-3 font-6">{collapsedView}</t>}
        closePulse={() => closePulse()}
        extended={() => (
          <div s="p-4 col-3 col children-centerx gap-2">
            <For each={() => VIEWS.filter((item) => item !== view())}>
              {(v) => (
                <t
                  s="px-2 py-2  row text-3 font-6 round-10px hover:( bg-#a6a6a6)"
                  click={() => {
                    view(v);
                    closePulse(1);
                    setTimeout(() => closePulse(0), 100);
                    setTimeout(() => collapsedView(v), 450);
                  }}
                >
                  {v}
                </t>
              )}
            </For>
          </div>
        )}
      />
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// DAYS SWITCHER
// ───────────────────────────────────────────────────────────────────────────────
function DaysSwitcher() {
  const syncFromDate = (d: Date) => {
    weekCursor(d.getTime());
    year(d.getFullYear());
    month(d.getMonth());
  };

  const shift = (delta: number) => {
    const d = new Date(weekCursor());
    if (view() === "Settimana") d.setDate(d.getDate() + delta * 7);
    else if (view() === "Mese") d.setMonth(d.getMonth() + delta);
    else if (view() === "3 Mesi") d.setMonth(d.getMonth() + delta * 3);
    else d.setFullYear(d.getFullYear() + delta);
    syncFromDate(d);
  };

  const switcherLabel = () => {
    if (view() === "Settimana") {
      const c = new Date(weekCursor());
      const day = (c.getDay() + 6) % 7;
      const start = new Date(c);
      start.setDate(c.getDate() - day);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `Settimana ${start.getDate()}-${end.getDate()}`;
    }
    if (view() === "Mese") return `${MONTHS_IT[month()]} ${year()}`;
    if (view() === "3 Mesi") {
      const start = new Date(year(), month(), 1);
      const end = new Date(year(), month() + 2, 1);
      return `${MONTHS_IT[start.getMonth()]} - ${MONTHS_IT[end.getMonth()]} ${end.getFullYear()}`;
    }
    return `${year()}`;
  };

  return (
    <div s="row centerx children-center gap-2 mb-3">
      <icon
        size="6"
        name="chevronLeft"
        stroke="3"
        s="hover:(bg-#a6a6a6 scale-120 ) px-2 py-1 round-10px cursor-pointer"
        click={() => shift(-1)}
      />
      <t s="text-3 font-6 minw-120px text-center">{switcherLabel}</t>
      <icon
        size="6"
        name="chevronRight"
        stroke="3"
        s="hover:(bg-#a6a6a6 scale-120 ) px-2 py-1 round-10px cursor-pointer"
        click={() => shift(1)}
      />
    </div>
  );
}
// ───────────────────────────────────────────────────────────────────────────────
// DAYS
// ───────────────────────────────────────────────────────────────────────────────
const weekCursor = state(new Date().getTime());
function Days() {
  const weekDays = () => {
    const c = new Date(weekCursor());
    const day = (c.getDay() + 6) % 7;
    const start = new Date(c);
    start.setDate(c.getDate() - day);

    return WEEKDAYS_IT.map((label, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { label, dayNumber: d.getDate() };
    });
  };
  return (
    <>
      <switch value={view}>
        <case when="Settimana">
          <div s="col gap-2 minw-0 w-100% text-left">
            <For each={weekDays}>
              {(d) => (
                <t s="text-3 font-5">
                  {d.label}: {d.dayNumber}
                </t>
              )}
            </For>
          </div>
        </case>
        <case when="Mese">
          <div s="des:(w-60%) mob:(w-100%) centerx">
            <Month monthOffset={0} />
          </div>
        </case>
        <case when="3 Mesi">
          <div s="des:(col-3 gap-4) mob:(col gap-2)">
            <For each={() => [0, 1, 2]}>
              {(i) => (
                <div s="w-100%">
                  <Month monthOffset={i} />
                </div>
              )}
            </For>
          </div>
        </case>
        <case when="Anno">
          <div s="des:(col-4 gap-3) mob:(col-2 gap-2)">
            <For each={() => Array.from({ length: 12 }, (_, i) => i)}>
              {(i) => <Month monthOffset={i} />}
            </For>
          </div>
        </case>
      </switch>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// MONTH
// ───────────────────────────────────────────────────────────────────────────────
function Month({ monthOffset = 0 }: { monthOffset?: number }) {
  const target = () => new Date(year(), month() + monthOffset, 1);
  const today = () => new Date();
  const daysInMonth = () => new Date(target().getFullYear(), target().getMonth() + 1, 0).getDate();
  const firstOffset = () =>
    (new Date(target().getFullYear(), target().getMonth(), 1).getDay() + 6) % 7;
  const monthLabel = () => `${MONTHS_IT[target().getMonth()]} ${target().getFullYear()}`;
  const isCurrentMonth = () =>
    target().getMonth() === today().getMonth() && target().getFullYear() === today().getFullYear();
  const monthWeeks = () => {
    const prevMonthDays = new Date(target().getFullYear(), target().getMonth(), 0).getDate();
    const offset = firstOffset();
    const cells = [
      ...Array.from({ length: offset }, (_, i) => ({
        day: prevMonthDays - offset + i + 1,
        muted: true,
        isToday: false,
      })),
      ...Array.from({ length: daysInMonth() }, (_, i) => ({
        day: i + 1,
        muted: false,
        isToday:
          i + 1 === today().getDate() &&
          target().getMonth() === today().getMonth() &&
          target().getFullYear() === today().getFullYear(),
      })),
    ];
    const missing = (7 - (cells.length % 7)) % 7;
    cells.push(
      ...Array.from({ length: missing }, (_, i) => ({
        day: i + 1,
        muted: true,
        isToday: false,
      })),
    );
    const weeks: { day: number; muted: boolean; isToday: boolean }[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  };

  const canOpenMonth = () => view() === "Anno" || view() === "3 Mesi";
  const openMonthFromYearView = () => {
    if (!canOpenMonth()) return;
    const t = target();
    year(t.getFullYear());
    month(t.getMonth());
    weekCursor(t.getTime());
    view("Mese");
    collapsedView("Mese");
  };

  return (
    <div
      s={() =>
        isCurrentMonth()
          ? `col gap-1 w-100% des:(p-2) mob:(p-2) bg-#ffffff0d b-1 b-primary round-10px ${canOpenMonth() ? "cursor-pointer" : ""}`
          : `col gap-1 w-100% des:(p-2) mob:(p-2) bg-#ffffff0d b-1 b-#ffffff1a round-10px ${canOpenMonth() ? "cursor-pointer" : ""}`
      }
      click={openMonthFromYearView}
    >
      <show when={() => view() !== "Mese"}>
        <t s={() => (isCurrentMonth() ? "text-2 font-6 text-center mb-1 text-primary" : "text-2 font-6 text-center mb-1")}>
          {monthLabel}
        </t>
      </show>
      <div s="row gap-2">
        <For each={() => ["L", "M", "M", "G", "V", "S", "D"]}>
          {(w) => <t s="w-14% text-center text-2 font-6">{w}</t>}
        </For>
      </div>
      <div s="col gap-2">
        <For each={monthWeeks}>
          {(week) => (
            <div s="row gap-2">
              <For each={() => week}>
                {(d) => <DayCompacted day={d.day} muted={d.muted} isToday={d.isToday} />}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
// ───────────────────────────────────────────────────────────────────────────────
// DAY COMPATTED
// ───────────────────────────────────────────────────────────────────────────────
function DayCompacted({ day, muted = false, isToday = false }: { day: number; muted?: boolean; isToday?: boolean }) {
  return (
    <div
      s={{
        base: {
          "aspect-square children-center": true,
          "w-12% round-5px": view() === "Anno",
          "w-14% round-10px": view() !== "Anno",
          "bg-primary text-background": isToday,
          "bg-#e5e5e5 text-background": !muted && !isToday,
          "bg-#e7e7e726": muted && !isToday,
        },
      }}
    >
      <t s="text-2 font-6">{day}</t>
    </div>
  );
}
