import { For, server, state } from "client";
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
        <div s="absolute left p-2">
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
const weekCursor = state(new Date().getTime());

function setCursorYearMonth(nextYear: number, nextMonth: number) {
  const cur = new Date(weekCursor());
  const curDay = cur.getDate();
  const maxDay = new Date(nextYear, nextMonth + 1, 0).getDate();
  const safeDay = Math.min(curDay, maxDay);
  const next = new Date(cur);
  next.setFullYear(nextYear, nextMonth, safeDay);
  weekCursor(next.getTime());
  year(nextYear);
  month(nextMonth);
}

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
                click={() => setCursorYearMonth(year() - 1, month())}
              />
              <t s="text-5 font-6">{year}</t>
              <icon
                size="6"
                name="chevronRight"
                stroke="3"
                s="hover:(bg-#a6a6a6 scale-120 ) px-2 py-1 round-10px"
                click={() => setCursorYearMonth(year() + 1, month())}
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
                      setTimeout(() => setCursorYearMonth(year(), MONTHS_IT.indexOf(y)), 450);
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
const COMPRESSION_MODES = ["full", "semi", "compress"] as const;
type CompressionMode = (typeof COMPRESSION_MODES)[number];
const compressionMode = state<CompressionMode>("full");
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
  const modeClosePulse = state(0);
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

  const modeMeta = (
    mode: CompressionMode,
  ): { icon: "maximize" | "minimize" | "minimize2"; label: string } => {
    if (mode === "full") return { icon: "maximize", label: "Massimizza" };
    if (mode === "semi") return { icon: "minimize", label: "Compressa" };
    return { icon: "minimize2", label: "Compressa tutto" };
  };

  return (
    <div s="row children-center gap-1">
      <Popmenu
        mode="light"
        direction="bottom-right"
        closePulse={() => modeClosePulse()}
        collapsed={() => (
          <icon
            size="6"
            name={modeMeta(compressionMode()).icon}
            stroke="2.5"
            s="p-1 round-10px cursor-pointer hover:(bg-#a6a6a6)"
          />
        )}
        extended={() => (
          <div s="p-2 col gap-1">
            <For each={() => COMPRESSION_MODES.filter((m) => m !== compressionMode())}>
              {(m) => (
                <div
                  s="row children-start gap-2 px-2 py-2 round-10px cursor-pointer hover:(bg-#a6a6a6) w-100%"
                  pointerdown={() => {
                    compressionMode(m);
                    modeClosePulse(modeClosePulse() + 1);
                  }}
                >
                  <icon size="5" name={modeMeta(m).icon} stroke="2.5" />
                  <t s="text-2 font-6">{modeMeta(m).label}</t>
                </div>
              )}
            </For>
          </div>
        )}
      />
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
const openingData = state(server.user.opening.get({ resourceId: undefined, itemId: undefined }));
const closureData = state(server.user.closures.get({ resourceId: undefined }));
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
    const base = target();
    const prevMonthDays = new Date(base.getFullYear(), base.getMonth(), 0).getDate();
    const offset = firstOffset();
    const cells = [
      ...Array.from({ length: offset }, (_, i) => ({
        day: prevMonthDays - offset + i + 1,
        muted: true,
        isToday: false,
        date: new Date(base.getFullYear(), base.getMonth() - 1, prevMonthDays - offset + i + 1),
      })),
      ...Array.from({ length: daysInMonth() }, (_, i) => ({
        day: i + 1,
        muted: false,
        isToday:
          i + 1 === today().getDate() &&
          target().getMonth() === today().getMonth() &&
          target().getFullYear() === today().getFullYear(),
        date: new Date(base.getFullYear(), base.getMonth(), i + 1),
      })),
    ];
    const missing = (7 - (cells.length % 7)) % 7;
    cells.push(
      ...Array.from({ length: missing }, (_, i) => ({
        day: i + 1,
        muted: true,
        isToday: false,
        date: new Date(base.getFullYear(), base.getMonth() + 1, i + 1),
      })),
    );
    const weeks: { day: number; muted: boolean; isToday: boolean; date: Date }[][] = [];
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
                {(d) => (
                  <DayCompacted
                    day={d.day}
                    muted={d.muted}
                    isToday={d.isToday}
                    click={() => {
                      if (view() !== "Mese") return;
                      weekCursor(d.date.getTime());
                      year(d.date.getFullYear());
                      month(d.date.getMonth());
                      view("Giorno");
                      collapsedView("Giorno");
                    }}
                  />
                )}
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
  click,
}: {
  day: number;
  muted?: boolean;
  isToday?: boolean;
  click?: () => void;
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
      click={click}
    >
      <t s="text-4 font-6">{day}</t>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// DAYS TIMELINE
// ───────────────────────────────────────────────────────────────────────────────
function DaysTimeline({ daysCount }: { daysCount: 1 | 3 | 7 }) {
  const timelineZoom = state(1.15);
  const BASE_HOUR_ROW_PX = 40;
  const MIN_ZOOM = 0.6;
  const MAX_ZOOM = 2.2;
  const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
  const hourRowPx = () => BASE_HOUR_ROW_PX * timelineZoom();

  const pinchPointers = new Map<number, { x: number; y: number }>();
  let pinchStartDistance = 0;
  let pinchStartZoom = 1;
  const COMPRESS_GAP_PX = 12;
  const pointerDistance = () => {
    const pts = [...pinchPointers.values()];
    if (pts.length < 2) return 0;
    const [a, b] = pts;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  };
  const updateZoom = (next: number) => timelineZoom(clampZoom(next));

  const OPENING_DAY_MAP = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
  const toLocalDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const parseTimeToMinutes = (t: string) => {
    const [hh = "0", mm = "0"] = t.split(":");
    return Number(hh) * 60 + Number(mm);
  };

  const mergeIntervals = (intervals: Array<{ start: number; end: number }>) => {
    if (intervals.length === 0) return intervals;
    const sorted = [...intervals]
      .filter((x) => x.end > x.start)
      .sort((a, b) => a.start - b.start);
    if (sorted.length === 0) return sorted;
    const out = [sorted[0]!];
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i]!;
      const prev = out[out.length - 1]!;
      if (cur.start <= prev.end) prev.end = Math.max(prev.end, cur.end);
      else out.push({ ...cur });
    }
    return out;
  };

  const dayClosedRanges = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    const dayKey = OPENING_DAY_MAP[(date.getDay() + 6) % 7];
    const openings = (openingData.openingHours?.() ?? [])
      .filter(
        (o: any) =>
          String(o.dayOfWeek).toLowerCase() === dayKey &&
          o.itemId == null &&
          o.resourceId == null,
      )
      .map((o: any) => ({
        start: Math.max(0, parseTimeToMinutes(String(o.startTime))),
        end: Math.min(24 * 60, parseTimeToMinutes(String(o.endTime))),
      }));
    const mergedOpen = mergeIntervals(openings);

    const closedFromOpening: Array<{ start: number; end: number }> = [];
    if (mergedOpen.length === 0) {
      closedFromOpening.push({ start: 0, end: 24 * 60 });
    } else {
      let cursor = 0;
      for (const w of mergedOpen) {
        if (w.start > cursor) closedFromOpening.push({ start: cursor, end: w.start });
        cursor = Math.max(cursor, w.end);
      }
      if (cursor < 24 * 60) closedFromOpening.push({ start: cursor, end: 24 * 60 });
    }

    const closureRanges = (closureData.closures?.() ?? [])
      .filter((c: any) => c.resourceId == null)
      .map((c: any) => {
        const s = new Date(c.startAt as any).getTime();
        const e = new Date(c.endAt as any).getTime();
        const overlapStart = Math.max(s, dayStart.getTime());
        const overlapEnd = Math.min(e, dayEnd.getTime());
        if (overlapEnd <= overlapStart) return null;
        const startMin = (overlapStart - dayStart.getTime()) / 60000;
        const endMin = (overlapEnd - dayStart.getTime()) / 60000;
        return { start: startMin, end: endMin };
      })
      .filter((x): x is { start: number; end: number } => x != null);

    const merged = mergeIntervals([...closedFromOpening, ...closureRanges]);
    console.log("[calendar][global-ranges]", {
      date: toLocalDateKey(dayStart),
      dayKey,
      openings,
      closedFromOpening,
      closureRanges,
      merged,
    });
    return merged;
  };

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

  const dayOpenRanges = (date: Date) => {
    const closed = dayClosedRanges(date);
    const out: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    for (const r of closed) {
      if (r.start > cursor) out.push({ start: cursor, end: r.start });
      cursor = Math.max(cursor, r.end);
    }
    if (cursor < 24 * 60) out.push({ start: cursor, end: 24 * 60 });
    return out;
  };

  const activeRanges = () => {
    if (compressionMode() === "full") return [{ start: 0, end: 24 * 60 }];
    const open = visibleDays()
      .flatMap((d) => dayOpenRanges(d.date))
      .filter((r) => r.end > r.start);
    if (open.length === 0) return [{ start: 0, end: 24 * 60 }];
    if (compressionMode() === "semi") {
      const minStart = Math.min(...open.map((r) => r.start));
      const maxEnd = Math.max(...open.map((r) => r.end));
      const start = Math.max(0, Math.floor(minStart / 60) * 60);
      const end = Math.min(24 * 60, Math.ceil(maxEnd / 60) * 60);
      if (end <= start) return [{ start: 0, end: 24 * 60 }];
      return [{ start, end }];
    }
    const merged = mergeIntervals(
      open.map((r) => ({
        start: Math.max(0, Math.floor(r.start / 60) * 60),
        end: Math.min(24 * 60, Math.ceil(r.end / 60) * 60),
      })),
    ).filter((r) => r.end > r.start);
    return merged.length > 0 ? merged : [{ start: 0, end: 24 * 60 }];
  };

  const formatHour = (m: number) => `${String((Math.floor(m / 60) + 24) % 24).padStart(2, "0")}:00`;

  const timelineRows = () => {
    const rows: Array<
      | { kind: "hour"; hour: number; heightPx: number }
      | { kind: "gap"; fromMin: number; toMin: number; heightPx: number }
    > = [];
    const ranges = activeRanges();
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i]!;
      const startHour = Math.floor(r.start / 60);
      const endHour = Math.ceil(r.end / 60);
      for (let h = startHour; h < endHour; h++) {
        rows.push({ kind: "hour", hour: h, heightPx: hourRowPx() });
      }
      if (compressionMode() === "compress" && i < ranges.length - 1) {
        const next = ranges[i + 1]!;
        rows.push({ kind: "gap", fromMin: r.end, toMin: next.start, heightPx: COMPRESS_GAP_PX });
      }
    }
    return rows;
  };

  const totalTimelinePx = () => timelineRows().reduce((acc, r) => acc + r.heightPx, 0);

  const compressMinutePx = (minute: number) => {
    const m = Math.max(0, Math.min(24 * 60, minute));
    let y = 0;
    const ranges = activeRanges();
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i]!;
      const rangePx = ((r.end - r.start) / 60) * hourRowPx();
      if (m >= r.end) {
        y += rangePx;
        if (compressionMode() === "compress" && i < ranges.length - 1) y += COMPRESS_GAP_PX;
        continue;
      }
      if (m > r.start) {
        const ratio = (m - r.start) / Math.max(1, r.end - r.start);
        y += rangePx * ratio;
      }
      break;
    }
    return y;
  };

  const closedRangesInWindow = (date: Date) => {
    const closed = dayClosedRanges(date);
    const clipped: Array<{ start: number; end: number }> = [];
    for (const c of closed) {
      for (const a of activeRanges()) {
        const start = Math.max(c.start, a.start);
        const end = Math.min(c.end, a.end);
        if (end > start) clipped.push({ start, end });
      }
    }
    return clipped;
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

      <div
        s="row gap-1 w-100%"
        wheel={(ev: WheelEvent) => {
          if (!ev.ctrlKey) return;
          ev.preventDefault();
          updateZoom(timelineZoom() - ev.deltaY * 0.0015);
        }}
        pointerdown={(ev: PointerEvent) => {
          pinchPointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
          if (pinchPointers.size === 2) {
            pinchStartDistance = pointerDistance();
            pinchStartZoom = timelineZoom();
          }
        }}
        pointermove={(ev: PointerEvent) => {
          if (!pinchPointers.has(ev.pointerId)) return;
          pinchPointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
          if (pinchPointers.size < 2 || pinchStartDistance <= 0) return;
          const nextDistance = pointerDistance();
          if (nextDistance <= 0) return;
          const ratio = nextDistance / pinchStartDistance;
          updateZoom(pinchStartZoom * ratio);
        }}
        pointerup={(ev: PointerEvent) => {
          pinchPointers.delete(ev.pointerId);
          if (pinchPointers.size < 2) pinchStartDistance = 0;
        }}
        pointercancel={(ev: PointerEvent) => {
          pinchPointers.delete(ev.pointerId);
          if (pinchPointers.size < 2) pinchStartDistance = 0;
        }}
      >
        <div s="col pr-1" style={() => ({ marginTop: `${-hourRowPx() * 0.52}px` })}>
          <For each={timelineRows}>
            {(row) => (
              <show
                when={() => row.kind === "hour"}
                fallback={
                  <div style={() => ({ height: `${row.heightPx}px` })} s="row children-center">
                    <t s="text-1 font-5 opacity-70">
                      {`${formatHour((row as { fromMin: number }).fromMin)}-${formatHour((row as { toMin: number }).toMin)}`}
                    </t>
                  </div>
                }
              >
                <div style={() => ({ height: `${row.heightPx}px` })} s="row children-center text-1 font-5">
                  {String((row as { hour: number }).hour).padStart(2, "0")}
                </div>
              </show>
            )}
          </For>
          <div style={() => ({ height: `${hourRowPx()}px` })} s="row children-center text-1 font-5">
            {() => String((Math.floor(activeRanges()[activeRanges().length - 1]!.end / 60) + 24) % 24).padStart(2, "0")}
          </div>
        </div>
        <div s={() => `${daysColsClass()} gap-2 w-100%`}>
          <For each={visibleDays}>
            {(d) => (
              <div s="relative col bg-#5e5e5e14 round-8px overflow-hidden">
                <For each={timelineRows}>
                  {(row) => (
                    <show
                      when={() => row.kind === "hour"}
                      fallback={<div style={() => ({ height: `${row.heightPx}px` })} s="bg-#ffffff08" />}
                    >
                      <div style={() => ({ height: `${row.heightPx}px` })} s="bb-1 b-#ffffff1a" />
                    </show>
                  )}
                </For>
                <For each={() => closedRangesInWindow(d.date)}>
                  {(r) => (
                    <div
                      s="absolute left right bg-#000000b3 events-none"
                      style={() => {
                        const span = Math.max(1, totalTimelinePx());
                        const startY = compressMinutePx(r.start);
                        const endY = compressMinutePx(r.end);
                        return {
                          top: `${(startY / span) * 100}%`,
                          height: `${Math.max(0, ((endY - startY) / span) * 100)}%`,
                        };
                      }}
                    />
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
