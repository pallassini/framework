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
    <div s="des:(w-90% h-85) mob:(w-100% h-74)  round-round mt-5 col minh-0 overflow-hidden">
      {/* HEADER */}
      <div s="row centerx children-center p-4 w-100% relative">
        <div s="absolute left m-4">
          <DateSwitcher />
        </div>
        <div s="center">
          <YearMonth />
        </div>
        <div s="absolute right m-4">
          <View />
        </div>
      </div>
      <div s="w-100% des:() mob:(p-0) scrolly ">
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
const VIEWS = ["Giorno", "Settimana", "3 Giorni", "Mese", "3 Mesi", "Anno"];
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
          <div s="p-4 col-3 col children-centerx gap-0">
            <For each={() => VIEWS.filter((item) => item !== view())}>
              {(v) => (
                <t
                  s="px-2 py-3  row text-3 font-6 round-10px hover:( bg-#a6a6a6)"
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
// DATE SWITCHER
// ───────────────────────────────────────────────────────────────────────────────
function DateSwitcher() {
  const leftPressed = state(false);
  const rightPressed = state(false);
  const syncFromDate = (d: Date) => {
    weekCursor(d.getTime());
    year(d.getFullYear());
    month(d.getMonth());
  };

  const shift = (delta: number) => {
    const d = new Date(weekCursor());
    if (view() === "Giorno") d.setDate(d.getDate() + delta);
    else if (view() === "Settimana") d.setDate(d.getDate() + delta * 7);
    else if (view() === "3 Giorni") d.setDate(d.getDate() + delta * 3);
    else if (view() === "Mese") d.setMonth(d.getMonth() + delta);
    else if (view() === "3 Mesi") d.setMonth(d.getMonth() + delta * 3);
    else d.setFullYear(d.getFullYear() + delta);
    syncFromDate(d);
  };

  const press = (side: "left" | "right", delta: number) => {
    if (side === "left") leftPressed(true);
    else rightPressed(true);
    shift(delta);
    setTimeout(() => {
      if (side === "left") leftPressed(false);
      else rightPressed(false);
    }, 120);
  };

  return (
    <div s="row children-center gap-1">
      <icon
        size="8"
        name="chevronLeft"
        stroke="3"
        s={() =>
          leftPressed()
            ? "bg-#a6a6a6 px-2 py-1 round-10px cursor-pointer"
            : "hover:(bg-#a6a6a6) px-2 py-1 round-10px cursor-pointer"
        }
        pointerdown={() => press("left", -1)}
      />
      <icon
        size="8"
        name="chevronRight"
        stroke="3"
        s={() =>
          rightPressed()
            ? "bg-#a6a6a6 px-2 py-1 round-10px cursor-pointer"
            : "hover:(bg-#a6a6a6) px-2 py-1 round-10px cursor-pointer"
        }
        pointerdown={() => press("right", 1)}
      />
    </div>
  );
}
// ───────────────────────────────────────────────────────────────────────────────
// DAYS
// ───────────────────────────────────────────────────────────────────────────────
const weekCursor = state(new Date().getTime());
function Days() {
  return (
    <>
      <switch value={view}>
        <case when="Giorno">
          <DaysTimeline daysCount={1} />
        </case>
        <case when="Settimana">
          <DaysTimeline daysCount={7} />
        </case>
        <case when="3 Giorni">
          <DaysTimeline daysCount={3} />
        </case>
        <case when="Mese">
          <div s="des:(w-60%) mob:(w-100%) centerx mt-4">
            <Month monthOffset={0} />
          </div>
        </case>
        <case when="3 Mesi">
          <div s="des:(col-3 gap-4) mob:(col gap-2) mt-4">
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
          <div s="des:(col-4 gap-3) mob:(col-2 gap-2) mt-4">
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
      s={{
        base: {
          "col gap-1 w-100% des:(p-2) mob:(p-2) bg-#ffffff0d b-1 round-10px": true,
          "b-primary": isCurrentMonth(),
          "b-#ffffff1a": !isCurrentMonth(),
          "cursor-pointer": canOpenMonth(),
        },
      }}
      click={openMonthFromYearView}
    >
      <show when={() => view() !== "Mese"}>
        <t
          s={() =>
            isCurrentMonth()
              ? "text-2 font-6 text-center mb-1 text-primary"
              : "text-2 font-6 text-center mb-1"
          }
        >
          {monthLabel}
        </t>
      </show>
      <div s="col-7 gap-2 w-100%">
        <For each={() => ["L", "M", "M", "G", "V", "S", "D"]}>
          {(w) => <t s="text-center text-2 font-6">{w}</t>}
        </For>
      </div>
      <div s="col gap-2">
        <For each={monthWeeks}>
          {(week) => (
            <div s="col-7 gap-2 w-100%">
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
function DayCompacted({
  day,
  muted = false,
  isToday = false,
}: {
  day: number;
  muted?: boolean;
  isToday?: boolean;
}) {
  return (
    <div
      s={{
        base: {
          "w-100% aspect-square children-center": true,
          "round-5px": view() === "Anno",
          "round-10px": view() !== "Anno",
          "bg-primary text-background": isToday,
          "bg-#e5e5e5 text-background": !muted && !isToday,
          "bg-#e7e7e726": muted && !isToday,
        },
      }}
    >
      <t s="text-4 font-6">{day}</t>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// DAYS TIMELINE
// ───────────────────────────────────────────────────────────────────────────────
function DaysTimeline({ daysCount }: { daysCount: 1 | 3 | 7 }) {
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  const visibleDays = () => {
    const cursor = new Date(weekCursor());
    const start = new Date(cursor);
    if (daysCount === 7) {
      const weekday = (cursor.getDay() + 6) % 7;
      start.setDate(cursor.getDate() - weekday);
    }

    return Array.from({ length: daysCount }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return {
        date: d,
        label: WEEKDAYS_IT[(d.getDay() + 6) % 7],
        dayNumber: d.getDate(),
      };
    });
  };

  const daysColsClass = () => (daysCount === 7 ? "col-7" : daysCount === 3 ? "col-3" : "col-1");

  return (
    <div s="col gap-2 w-100% mb-10 px-2">
      <div s="row  gap-1 w-100% sticky top z-10 bg-background py-1">
        <div s="pr-1">
          <div s="h-5 row children-center text-1 font-5 opacity-0">00</div>
        </div>
        <div s={() => `${daysColsClass()} gap-2 w-100%`}>
          <For each={visibleDays}>
            {(d) => (
              <div s="col w-100% children-center">
                <t s="text-2 font-6">{d.label.slice(0, 3)}</t>
                <t s="text-6 font-6">{d.dayNumber}</t>
              </div>
            )}
          </For>
        </div>
      </div>

      <div s="row gap-1 w-100%">
        <div s="col pr-1 -mt-14">
          <For each={() => HOURS}>
            {(h) => (
              <div s="h-10 row children-center text-1 font-5">{String(h).padStart(2, "0")}</div>
            )}
          </For>
        </div>
        <div s={() => `${daysColsClass()} gap-2 w-100%`}>
          <For each={visibleDays}>
            {() => (
              <div s="col bg-#ffffff14 round-8px overflow-hidden">
                <For each={() => HOURS}>{() => <div s="h-10 bb-1 b-#ffffff1a" />}</For>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
