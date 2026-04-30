import { For, server, state } from "client";
import Menu from "../../_components/menu";
import { TimePicker } from "../../../_components/time-picker";

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
// DAY
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
            return (
              <div
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
                    <t s="text-5 font-6 text-#fff">{d.label}</t>
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
      <div s="mt-6 gap-3 col">
        <For each={rows}>
          {(o, i) =>
            (() => {
              const list = rows();
              const prev = i > 0 ? list[i - 1] : undefined;
              const next = i < list.length - 1 ? list[i + 1] : undefined;
              return (
                <div s="row gap-1 text-6 text-#fff children-center">
                  <TimePicker
                    value={o.startTime}
                    min={prev ? toHM(prev.endTime) : undefined}
                    max={subStep(minTime(o.endTime, next?.startTime))}
                    onChange={(v) => {
                      const nextStart = String(v);
                      if (prev && toMinutes(nextStart) < toMinutes(prev.endTime)) return;
                      if (next && toMinutes(nextStart) >= toMinutes(next.startTime)) return;
                      if (toMinutes(nextStart) >= toMinutes(o.endTime)) return;
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
                    min={addStep(o.startTime)}
                    max={next ? subStep(next.startTime) : undefined}
                    onChange={(v) => {
                      const nextEnd = String(v);
                      if (toMinutes(nextEnd) <= toMinutes(o.startTime)) return;
                      if (next && toMinutes(nextEnd) >= toMinutes(next.startTime)) return;
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

function addStep(v: string): string {
  const total = toMinutes(v) + 5;
  const clamped = Math.min(total, 23 * 60 + 55);
  const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mm = String(clamped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function subStep(v: string): string {
  const total = toMinutes(v) - 5;
  const clamped = Math.max(total, 0);
  const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mm = String(clamped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function toMinutes(v: string): number {
  const [h = "00", m = "00"] = (v ?? "").split(":");
  return Number(h) * 60 + Number(m);
}

function toHM(v: string): string {
  const [h = "00", m = "00"] = (v ?? "").split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}
