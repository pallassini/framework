import { device, For, server, state, watch } from "client";
import { TimePicker } from "../../../_components/time-picker";
import Popmenu from "../../../_components/popmenu";

export default function Weekdays() {
  return (
    <>
      <div s="b-animated(single, #fff, blur-2, power-5, spread-4, dur-15) bg-background b-4 b-#191919 relative w-100% round-round col centerx px-12 py-6 mob:(px-2 py-4)">
        <Days />
      </div>
    </>
  );
}
// ───────────────────────────────────────────────────────────────────────────────
// DAYS
// ───────────────────────────────────────────────────────────────────────────────
function Days() {
  const deleteModeByDay = state(new Set<string>());
  const isDeleteMode = (day: string) => deleteModeByDay().has(day);
  const setDeleteMode = (day: string, on: boolean) => {
    const next = new Set(deleteModeByDay());
    if (on) next.add(day);
    else next.delete(day);
    deleteModeByDay(next);
  };

  return (
    <>
      <div s="col-4 mob:(col-2) mt-4 gap-4">
        <For
          each={[
            { label: "Lunedì", key: "monday" },
            { label: "Martedì", key: "tuesday" },
            { label: "Mercoledì", key: "wednesday" },
            { label: "Giovedì", key: "thursday" },
            { label: "Venerdì", key: "friday" },
            { label: "Sabato", key: "saturday" },
            { label: "Domenica", key: "sunday" },
          ]}
        >
          {(d) => {
            const closed = () => {
              const v = opening();
              if (!Array.isArray(v)) return false;
              return !v.some((o) => o?.dayOfWeek === d.key);
            };
            const hover = state(false);
            return (
              <div
                hover={hover}
                s={{
                  base: {
                    "relative w-100% h-25 overflow-hidden round-round mb-3 text-background shadow(primary, blur-18, spread--6, x-0, y-10, opacity-0.72)  bg-gradient(0deg, var(--primary) 0%, var(--primary)20%, transparent 70%) px-1px pb-2px": true,
                    "shadow(error, blur-18, spread--6, x-0, y-10, opacity-0.72) bg-gradient(0deg, var(--error) 0%, transparent 70%)":
                      closed,
                  },
                }}
              >
                <div
                  s={{
                    base: {
                      "relative col w-100% h-24.8 min-h-0 overflow-hidden round-round text-background bg-background pb-2": true,
                      "": closed,
                    },
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    boxSizing: "border-box",
                    minHeight: 0,
                  }}
                >
                  <div s=" round-16.5px " show={closed}>
                    <div
                      s={{
                        base: {
                          "fw-card-aurora-mesh fw-card-aurora-accent-primary": true,
                          "fw-card-aurora-mesh fw-card-aurora-accent-error": closed,
                        },
                      }}
                    />
                  </div>

                  <div
                    s="relative w-100% min-h-0 overflow-hidden pt-3 px-2 mob:(pt-2 px-1.5)"
                    style={{
                      flex: "1 1 0%",
                      minHeight: 0,
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      s="col min-h-0 min-w-0 w-100%"
                      style={{
                        flex: "1 1 0%",
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                      }}
                    >
                      <div s="relative row w-100% left items-centery min-h-7 mb-1 shrink-0 pr-10">
                        <t s="text-4 font-6 text-#fff">{d.label}</t>
                        <div
                          s={{
                            base: {
                              "absolute top-0 right-0 row children-center": true,
                              "opacity-100": () =>
                                !closed() && (hover() || device() === "mob"),
                              "opacity-0 pointer-events-none": () =>
                                closed() || (!hover() && device() !== "mob"),
                            },
                          }}
                        >
                          <DayMenu
                            day={d.key}
                            deleteMode={() => isDeleteMode(d.key)}
                            setDeleteMode={(on) => setDeleteMode(d.key, on)}
                          />
                        </div>
                      </div>
                      {/* OPENINGS */}
                      <show when={() => !closed()}>
                        <Openings
                          day={d.key}
                          deleteMode={() => isDeleteMode(d.key)}
                          setDeleteMode={(on) => setDeleteMode(d.key, on)}
                        />
                      </show>
                      <show when={closed}>
                        <div
                          s={{
                            base: {
                              "text-5 px-6 py-4 round-30px font-6 centerx row mt-10 des:(w-5.5 h-4.5) mob:(w-5.5 h-4.5) px-1.5 py-1.5 overflow-hidden shrink-0": true,
                            "bg-gradient(circle, #b807078a 0%, #b80707c2 50%, #e00303 100%) text-#fff":
                              () => activatingClosedDay() !== d.key,
                            "bg-primary text-background shadow(primary, blur-18, spread--6, x-0, y-8, opacity-0.45)":
                              () => activatingClosedDay() === d.key,
                            "cursor-pointer": () => activatingClosedDay() == null,
                            "pointer-events-none opacity-70": () =>
                              activatingClosedDay() != null && activatingClosedDay() !== d.key,
                            },
                            transition:
                              activatingClosedDay() === d.key
                                ? {
                                    property: ["background-color", "box-shadow", "color"],
                                    duration: TOGGLE_SLIDE_MS,
                                    ease: "cubic-bezier(0.25, 0.9, 0.35, 1)",
                                  }
                                : undefined,
                          }}
                          click={(e: Event) => {
                            e.stopPropagation();
                            if (activatingClosedDay() != null) return;
                            activatingClosedDay(d.key);
                          }}
                        >
                          <div s="row w-100% h-100% min-h-0">
                            <div
                              s={{
                                base:
                                  "w-1.95 h-100% shrink-0 round-circle bg-#fff shadow(#000000, blur-20, spread-2, x-4, y-8, opacity-0.92)",
                                ...(activatingClosedDay() === d.key
                                  ? {
                                      animate: [
                                        {
                                          x: [0, "3.52rem"],
                                          duration: TOGGLE_SLIDE_MS,
                                          ease: "out",
                                          fill: "forwards",
                                          onEnd: () => {
                                            const dk = d.key;
                                            if (activatingClosedDay() !== dk) return;
                                            void (async () => {
                                              await createFirstOpeningForDay(dk);
                                              activatingClosedDay(null);
                                            })();
                                          },
                                        },
                                      ],
                                    }
                                  : {}),
                              }}
                            />
                          </div>
                        </div>
                      </show>
                    </div>
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </>
  );
}
const opening = state(server.user.opening.get);
/** Giorno in animazione toggle “chiudi/apri”: prima della `create`. */
const activatingClosedDay = state<string | null>(null);

/** Durata corsa thumb (ms); la `create` parte in `animate.onEnd`. */
const TOGGLE_SLIDE_MS = 260;
/** Stessa fascia iniziale di `DayMenu` → `nextSlot()` con lista vuota. */
function firstOpeningSlotForEmptyDay(): { startTime: string; endTime: string } {
  return { startTime: "09:00:00", endTime: "10:00:00" };
}

async function createFirstOpeningForDay(day: string): Promise<void> {
  const slot = firstOpeningSlotForEmptyDay();
  try {
    const created = await server.user.opening.create({
      dayOfWeek: day,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
    const current = opening();
    if (!Array.isArray(current)) return;
    const createdRows = Array.isArray(created)
      ? created
      : created && typeof created === "object" && "rows" in created
        ? ((created as { rows?: unknown }).rows ?? [])
        : [];
    if (Array.isArray(createdRows) && createdRows.length > 0) {
      opening([...current, ...(createdRows as any[])] as any);
    }
  } catch {
    /* errore RPC: giorno resta chiuso */
  }
}

/** Marca la riga fascia: il listener globale chiude delete mode solo se il tap non cade qui. */
const CAL_TIME_FRAME_ATTR = "data-fw-calendar-timeframe";

function Openings(p: {
  day: string;
  deleteMode: () => boolean;
  setDeleteMode: (on: boolean) => void;
}) {
  watch(() => {
    if (!p.deleteMode()) return;
    const day = p.day;
    const onDocDown = (ev: Event): void => {
      for (const n of ev.composedPath()) {
        if (n instanceof Element && n.getAttribute(CAL_TIME_FRAME_ATTR) === day) return;
      }
      p.setDeleteMode(false);
    };
    document.addEventListener("pointerdown", onDocDown, true);
    watch.onCleanup(() => document.removeEventListener("pointerdown", onDocDown, true));
  });

  const localPatch = state(new Map<string, { startTime?: string; endTime?: string }>());
  const rows = () =>
    opening()
      ?.filter((o) => o.dayOfWeek === p.day)
      .map((o) => ({ ...o, ...localPatch().get(o.id) }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime)) ?? [];
  const applyLocal = (id: string, patch: { startTime?: string; endTime?: string }) => {
    const prev = localPatch();
    const next = new Map(prev);
    next.set(id, { ...prev.get(id), ...patch });
    localPatch(next);
    return prev;
  };

  const removeOpeningById = async (e: Event, id: string): Promise<void> => {
    e.stopPropagation();
    const key = String(id);
    const prevData = opening();
    if (Array.isArray(prevData)) {
      opening(prevData.filter((r) => r != null && String(r?.id) !== key) as any);
    }
    await server.user.opening
      .remove(
        { id: key },
        {
          onError: () => Array.isArray(prevData) && opening(prevData as any),
        },
      )
      .catch(() => {});
    const remaining = rows().filter((r) => String(r.id) !== key);
    if (remaining.length === 0) p.setDeleteMode(false);
  };

  /** Hover/focus primary; padding orizzontale ridotto sul guscio (l’altezza resta comoda). */
  const timePickShellBase =
    "flex-1 basis-0 min-w-0 min-h-10 self-stretch box-border b-2 b-#2a2a2a py-2 px-0 font-6 text-#fff row children-center hover:(b-primary) focus:(b-primary) text-3 des:(text-2)";
  const timePickShell = (last: boolean, side: "start" | "end"): string => {
    if (!last) return `${timePickShellBase} round-none`;
    if (side === "start") return `${timePickShellBase} roundbl-6px`;
    return `${timePickShellBase} roundbr-6px`;
  };

  return (
    <div
      s="col min-h-0 min-w-0 w-100% mt-3 centerx children-centerx"
      style={{
        flex: "1 1 0%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div s="row flex-1 min-h-0 w-100% min-w-0 items-stretch mob:(gap-2) des:(gap-2 self-center w-fit max-w-full) centerx children-centerx">
        <div
          s="w-100% des:(w-66% shrink-0) flex col bg-background overflow-hidden round-6px self-stretch"
          style={{
            minHeight: 0,
            minWidth: 0,
            overflow: "hidden",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            s={{
              base: {
                "row w-100% min-w-0 shrink-0 children-centerx py-1 des:(py-0.75) bb-1 b-#2a2a2a roundt-6px overflow-hidden": true,
                "bg-primary": () => !p.deleteMode(),
                "bg-error": () => p.deleteMode(),
              },
            }}
          >
            <div s="flex-1 min-w-0 w-50% row children-center py-1 px-1 br-1 b-#2a2a2a">
              <t
                s={{
                  base: {
                    "text-3 des:(text-2) font-6": true,
                    "text-background": () => !p.deleteMode(),
                    "text-#fff": () => p.deleteMode(),
                  },
                }}
              >
                Inizio
              </t>
            </div>
            <div s="flex-1 min-w-0 w-50% row children-center py-1 px-1">
              <t
                s={{
                  base: {
                    "text-3 des:(text-2) font-6": true,
                    "text-background": () => !p.deleteMode(),
                    "text-#fff": () => p.deleteMode(),
                  },
                }}
              >
                Fine
              </t>
            </div>
          </div>

          <div
            s="min-h-0 min-w-0 w-100% scrolly flex-1"
            style={{
              flex: "1 1 0%",
              minHeight: 0,
              overflowY: "auto",
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch",
              boxSizing: "border-box",
            }}
          >
            <For each={rows}>
              {(o, i) => {
                const list = rows();
                const prev = i > 0 ? list[i - 1] : undefined;
                const next = i < list.length - 1 ? list[i + 1] : undefined;
                const isLast = i >= list.length - 1;
                const deleting = p.deleteMode();

                return (
                  <div
                    {...{ [CAL_TIME_FRAME_ATTR]: p.day }}
                    s={{
                      base: {
                        "row w-100% min-w-0 shrink-0 items-stretch children-centerx min-h-10": true,
                        "bb-1 b-#2a2a2a": !isLast,
                      },
                    }}
                  >
                    <TimePicker
                      fillCell
                      mode="none"
                      compact
                      size={device() === "des" ? 3 : 4}
                      value={o.startTime}
                      disabled={deleting}
                      min={prev ? toHM(prev.endTime) : undefined}
                      max={minTime(o.endTime, next?.startTime)}
                      onChange={(v) => {
                        const nextStart = String(v);
                        if (prev && toMinutes(nextStart) < toMinutes(prev.endTime)) return;
                        if (next && toMinutes(nextStart) > toMinutes(next.startTime)) return;
                        if (toMinutes(nextStart) > toMinutes(o.endTime)) return;
                        void (async () => {
                          const snap = applyLocal(o.id, { startTime: nextStart });
                          await server.user.opening
                            .update(
                              { id: o.id, startTime: nextStart },
                              { onError: () => localPatch(snap) },
                            )
                            .catch(() => {});
                        })();
                      }}
                      s={() => timePickShell(isLast, "start")}
                    />
                    <TimePicker
                      fillCell
                      mode="none"
                      compact
                      size={device() === "des" ? 3 : 4}
                      value={o.endTime}
                      disabled={deleting}
                      min={o.startTime}
                      max={next ? next.startTime : undefined}
                      onChange={(v) => {
                        const nextEnd = String(v);
                        if (toMinutes(nextEnd) < toMinutes(o.startTime)) return;
                        if (next && toMinutes(nextEnd) > toMinutes(next.startTime)) return;
                        void (async () => {
                          const snap = applyLocal(o.id, { endTime: nextEnd });
                          await server.user.opening
                            .update(
                              { id: o.id, endTime: nextEnd },
                              { onError: () => localPatch(snap) },
                            )
                            .catch(() => {});
                        })();
                      }}
                      s={() => timePickShell(isLast, "end")}
                    />
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        <div
          {...{ [CAL_TIME_FRAME_ATTR]: p.day }}
          style={() =>
            p.deleteMode()
              ? ({
                  display: "flex",
                  flexDirection: "column",
                  flexShrink: "0",
                  alignSelf: "stretch",
                  position: "relative",
                  zIndex: "10",
                  minWidth: "2.75rem",
                } as import("csstype").Properties)
              : ({ display: "none" } as import("csstype").Properties)
          }
        >
          <div
            s="shrink-0 w-100% row center items-center min-h-10 mob:(py-1) des:(py-0.75)"
            aria-hidden
          />
          <For each={rows}>
            {(o, i) => {
              const isLast = i >= rows().length - 1;
              return (
                <div
                  s={{
                    base: {
                      "shrink-0 w-100% min-h-10 row center items-center box-border": true,
                      "bb-1 b-#2a2a2a": !isLast,
                    },
                  }}
                >
                  <div
                    s="p-1 bg-error round-6px row center cursor-pointer shrink-0"
                    click={(e: Event) => {
                      const id = o.id;
                      if (id == null) return;
                      void removeOpeningById(e, String(id));
                    }}
                  >
                    <icon name="trash" size={5} stroke={3} s="text-#fff p-0 shrink-0" />
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
}

function minTime(a: string, b?: string): string {
  if (!b) return a;
  return toMinutes(a) <= toMinutes(b) ? a : b;
}

function toMinutes(v: string): number {
  const [h = "00", m = "00"] = (v ?? "").split(":");
  return Number(h) * 60 + Number(m);
}

function toHM(v: string): string {
  const [h = "00", m = "00"] = (v ?? "").split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

function withSeconds(v: string): string {
  const [h = "00", m = "00"] = (v ?? "").split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`;
}

function addMinutes(v: string, delta: number): string {
  const total = toMinutes(v) + delta;
  const clamped = Math.max(0, Math.min(total, 23 * 60 + 55));
  const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mm = String(clamped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function DayMenu(p: {
  day: string;
  deleteMode: () => boolean;
  setDeleteMode: (on: boolean) => void;
}) {
  const closePulse = state(false);
  const nextSlot = () => {
    const data = opening();
    const list = (Array.isArray(data) ? data : [])
      .filter((o) => o?.dayOfWeek === p.day)
      .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
    if (list.length === 0) return { startTime: "09:00:00", endTime: "10:00:00" };
    const last = list[list.length - 1]!;
    return {
      startTime: withSeconds(toHM(String(last.endTime))),
      endTime: withSeconds(addMinutes(String(last.endTime), 60)),
    };
  };
  return (
    <>
      <Popmenu
        mode="light"
        direction="bottom-left"
        collapsedS="p-1"
        closePulse={() => closePulse()}
        collapsed={() => <icon name="dotsVertical" size="6" stroke="3" s="p-0" />}
        extended={() => (
          <div s="col gap-0 p-2">
            {/* CREATE OPENING */}
            <div
              s="row gap-1 left children-left text-4 font-6 px-4 py-2 hover:(bg-#bababa) w-100% round-10px"
              click={async () => {
                closePulse(true);
                setTimeout(() => closePulse(false), 50);
                const slot = nextSlot();
                try {
                  const created = await server.user.opening.create({
                    dayOfWeek: p.day,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                  });
                  const current = opening();
                  if (!Array.isArray(current)) return;
                  const createdRows = Array.isArray(created)
                    ? created
                    : created && typeof created === "object" && "rows" in created
                      ? ((created as { rows?: unknown }).rows ?? [])
                      : [];
                  if (Array.isArray(createdRows) && createdRows.length > 0) {
                    opening([...current, ...(createdRows as any[])] as any);
                  }
                } catch {}
              }}
            >
              <icon name="plus" size="5" stroke="3" s="p-0" />
              <t>Crea fascia </t>
            </div>
            {/* DELETE OPENING */}
            <div
              s={{
                base: {
                  "row gap-1 center children-center text-4 font-6 round-10px px-4 py-2 cursor-pointer": true,
                  "text-error hover:(bg-#bababa)": () => !p.deleteMode(),
                  "bg-error text-#fff": () => p.deleteMode(),
                },
              }}
              click={() => {
                closePulse(true);
                setTimeout(() => closePulse(false), 50);
                p.setDeleteMode(!p.deleteMode());
              }}
            >
              <icon name="trash" size="5" stroke="3" s="" />
              <t>Elimina fascia</t>
            </div>
          </div>
        )}
      />
    </>
  );
}
