import { For, server, state } from "client";
import { data } from "..";

// IF RESOURCE HAVE ITS OWN HOURS USE IT, OTHERWISE USE THE GLOBAL HOURS
export default function Resources() {
  return (
    <>
      {/* // ───────────────────────────────────────────────────────────────────────────────
          // GLOBAL HOURS
          // ────────────────────────────────────────────────────────────────────────────────── */}
      <div s={{ base: "text-6 font-6", des: "ml-10vw b-2px b-secondary col gapy-1vh round-round px-1vw py-1vh mt-10vh mx-5vw" }}>
        <t>ORARI GLOBALI</t>
        {/* DAYS */}
        <div s="row gapx-1vw mt-5vh children-center">
          <For each={week}>
            {([day, name]) => (
              <div s={{ base: "b-1px round-round b-#2a2a2a", des: "col gapy-0.3vh px-1.2vw py-1vh w-15%" }}>
                <t s={{ des: "font-6" }}>{name}</t>
                {/* HOURS */}
                <div s={{ des: "col w-100% gapy-0.2vh mt-1vh" }}>
                  <For
                    each={() =>
                      (data.openingHours() ?? []).filter(
                        (o) => o.resourceId == null && o.dayOfWeek === day,
                      )
                    }
                  >
                    {(o) => {
                      const startFocus = state(false);
                      const endFocus = state(false);
                      const rowHover = state(false);
                      return (
                        <div s="row w-100% children-centery centerx gapx-0.4vw" hover={rowHover}>
                          <input
                            type="time"
                            s={{
                              base: {
                                "bg-transparent text-2 round-10px b-1px px-0.3vw py-0.2vh": true,
                                "b-#2a2a2a": () => !startFocus(),
                                "b-secondary": startFocus,
                              },
                            }}
                            defaultValue={timeNoSeconds(o.startTime)}
                            click={(ev: MouseEvent) => showTimePicker(ev.currentTarget as HTMLInputElement)}
                            focus={(ev: FocusEvent) => {
                              startFocus(true);
                              showTimePicker(ev.currentTarget as HTMLInputElement);
                            }}
                            blur={async (value) => {
                              startFocus(false);
                              await server.booker.openingHourUpdate({ id: o.id, startTime: value });
                            }}
                          />
                          <t s="text-2 opacity-50">–</t>
                          <input
                            type="time"
                            s={{
                              base: {
                                "bg-transparent text-2 round-10px b-1px px-0.3vw py-0.2vh": true,
                                "b-#2a2a2a": () => !endFocus(),
                                "b-secondary": endFocus,
                              },
                            }}
                            defaultValue={timeNoSeconds(o.endTime)}
                            click={(ev: MouseEvent) => showTimePicker(ev.currentTarget as HTMLInputElement)}
                            focus={(ev: FocusEvent) => {
                              endFocus(true);
                              showTimePicker(ev.currentTarget as HTMLInputElement);
                            }}
                            blur={async (value) => {
                              endFocus(false);
                              await server.booker.openingHourUpdate({ id: o.id, endTime: value });
                            }}
                          />
                          <icon
                            name="trash"
                            size="3"
                            show={rowHover}
                            color="#fa0000"
                            s={{
                              base: {
                                "duration-150": true,
                              },
                            }}
                            click={async () => {
                              await server.booker.openingHourDelete(
                                { id: o.id },
                                {
                                  onSuccess: () => {
                                    data((d) =>
                                      d
                                        ? {
                                            ...d,
                                            openingHours: (d.openingHours ?? []).filter((x) => x.id !== o.id),
                                          }
                                        : d,
                                    );
                                  },
                                },
                              );
                            }}
                          />
                        </div>
                      );
                    }}
                  </For>
                </div>
                {/* CREATE */}
                <div
                    s={{
                      base: "text-2",
                      des: "opacity-90 b-1px round-10px p-0.3vw cursor-pointer mt-2vh centerx children-center hover:(bg-secondary)",
                    }}
                    click={async () => {
                      await server.booker.openingHourCreate(
                        [{ dayOfWeek: day, startTime: "09:00:00", endTime: "18:00:00" }],
                        {
                          onSuccess: (res) => {
                            data((d) =>
                              d
                                ? {
                                    ...d,
                                    openingHours: [...(d.openingHours ?? []), ...res.openingHours],
                                  }
                                : d,
                            );
                          },
                        },
                      );
                    }}
                  >
                    <icon name="plus" size="3" />
                  </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </>
  );
}
// ───────────────────────────────────────────────────────────────────────────────
// UTILS
// ───────────────────────────────────────────────────────────────────────────────
const week = [
  ["monday", "Lunedì"],
  ["tuesday", "Martedì"],
  ["wednesday", "Mercoledì"],
  ["thursday", "Giovedì"],
  ["friday", "Venerdì"],
  ["saturday", "Sabato"],
  ["sunday", "Domenica"],
] as const;

/** `09:00:00` → `09:00`; `09:30:00` → `09:30`; già `09:00` resta uguale. */
function timeNoSeconds(t: string): string {
  const p = t.trim().split(":");
  if (p.length === 3 && p[2] === "00") return `${p[0]}:${p[1]}`;
  return t;
}

/** Apre il time picker nativo via `showPicker()` (se supportato e in gesture utente). */
function showTimePicker(el: HTMLInputElement): void {
  try {
    el.showPicker?.();
  } catch {
    /* NotAllowedError fuori dal gesture utente: ignora. */
  }
}
