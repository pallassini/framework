import { For, server, state } from "client";
import Menu from "../../_components/menu";
import { TimePicker } from "../../../_components/time-picker";
import Popmenu from "../../../_components/popmenu";

export default function Calendar() {
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky h-100)">
          <Menu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19) mob:(mb-30)">
          <div s=" des:(w-80 mt-20 gap-6 col) mob:(col w-100% mt-20 gap-6 px-1) ">
            <div s="b-animated(single, #fff, blur-2, power-5, spread-4, dur-15) bg-background b-1 b-#191919 relative w-100% round-round col centerx px-12 py-6 mob:(px-2 py-4)">
              {/* HEADER */}

              <Days />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
// ───────────────────────────────────────────────────────────────────────────────
// DAYS
// ───────────────────────────────────────────────────────────────────────────────
function Days() {
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
                    "relative w-100% minh-25 round-round mb-3 text-background shadow(primary, blur-18, spread--6, x-0, y-10, opacity-0.72)  bg-gradient(0deg, var(--primary) 0%, var(--primary)20%, transparent 70%) px-1px pb-2px": true,
                    "shadow(error, blur-18, spread--6, x-0, y-10, opacity-0.72) bg-gradient(0deg, var(--error) 0%, transparent 70%)":
                      closed,
                  },
                }}
              >
                <div
                  s={{
                    base: {
                      "relative w-100% minh-25 round-round   text-background bg-background": true,
                      "": closed,
                    },
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

                  <div s="relative col p-4">
                    <div s="row">
                      <t s="text-5 font-6 text-#fff">{d.label}</t>
                      {/* MENU */}
                      <div
                        s={{
                          base: {
                            "right": true,
                            "opacity-100": () => hover() && !closed(),
                            "opacity-0 pointer-events-none": () => !hover() || closed(),
                          },
                        }}
                      >
                        <DayMenu day={d.key} />
                      </div>
                    </div>
                    {/* OPENINGS */}
                    <show when={() => !closed()}>
                      <Openings day={d.key} />
                    </show>
                    <show when={closed}>
                      <div
                        s={{
                          base: {
                            "text-5 px-6 py-4 round-30px bg-gradient(circle, #b807078a 0%,#b80707c2 50%, #e00303 100%) font-6 centerx  text-#fff row mt-15 des:(w-5.5 h-4.5) mob:(w-5.5 h-4.5) px-1.5 py-1.5": true,
                          },
                        }}
                      >
                        <div s="row">
                          <div s="w-1.95 h-100% round-circle bg-#fff shadow(#000000, blur-20, spread-2, x-4, y-8, opacity-0.92)"></div>
                        </div>
                      </div>
                    </show>
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
function Openings({ day }: { day: string }) {
  const localPatch = state(new Map<string, { startTime?: string; endTime?: string }>());
  const rows = () =>
    opening()
      ?.filter((o) => o.dayOfWeek === day)
      .map((o) => ({ ...o, ...localPatch().get(o.id) }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime)) ?? [];
  const applyLocal = (id: string, patch: { startTime?: string; endTime?: string }) => {
    const prev = localPatch();
    const next = new Map(prev);
    next.set(id, { ...prev.get(id), ...patch });
    localPatch(next);
    return prev;
  };

  return (
    <>
      <div s="mt-6 gap-3 col centerx children-centerx">
          <For each={rows}>
            {(o, i) =>
              (() => {
                const list = rows();
                const prev = i > 0 ? list[i - 1] : undefined;
                const next = i < list.length - 1 ? list[i + 1] : undefined;
                return (
                  <div s="row gap-1 text-6 center text-#fff children-center b-2 b-#e3e3e370  round-10px">
                  <TimePicker
                    value={o.startTime}
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
                  />
                  <icon name="minus" size="3" />
                  <TimePicker
                    value={o.endTime}
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
                  />
                  </div>
                );
              })()
            }
          </For>
      </div>
    </>
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

function DayMenu({ day }: { day: string }) {
  const nextSlot = () => {
    const data = opening();
    const list = (Array.isArray(data) ? data : [])
      .filter((o) => o?.dayOfWeek === day)
      .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
    if (list.length === 0) return { startTime: "09:00:00", endTime: "10:00:00" };
    const last = list[list.length - 1]!;
    return {
      startTime: withSeconds(toHM(String(last.startTime))),
      endTime: withSeconds(addMinutes(String(last.startTime), 60)),
    };
  };
  return (
    <>
      <Popmenu
        mode="light"
        direction="bottom"
        collapsedS="p-1"
        collapsed={() => <icon name="dotsVertical" size="6" stroke="3" s="p-0" />}
        extended={() => (
          <div s="col gap-2 p-2">
            <icon
              name="plus"
              size="5"
              stroke="3"
              s="p-0"
              click={async () => {
                const slot = nextSlot();
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
                  // noop: nessun optimistic update locale da rollbackare.
                }
              }}
            />
          </div>
        )}
      />
    </>
  );
}
