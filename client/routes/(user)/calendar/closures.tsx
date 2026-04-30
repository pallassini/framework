import { For, Form, resolveFieldBinding, server, state, v } from "client";
import {
  addDaysIsoLocal,
  isValidIsoDate,
  todayIsoLocal,
  toIsoLocal,
} from "../../../_components/date-picker";
import Input from "../../../_components/input";
import Popmenu from "../../../_components/popmenu";

type ClosureRow = {
  id?: string;
  /** Opzionale: colonna motivazione nella tabella. */
  note?: string | null;
  startAt: Date | string | number;
  endAt: Date | string | number;
};

/** RPC → `Date` per confronti/display. */
const closureInstant = (v: Date | string | number): Date => (v instanceof Date ? v : new Date(v));

/** Stesso istante del vecchio `fmtClosure` (locale breve), qui spezzato per `Input date` + `Input time`. */
function closureSplitInstant(v: Date | string | number): { date: string; time: string } {
  const d = closureInstant(v);
  return {
    date: toIsoLocal(d),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}
const sortClosureRows = (raw: unknown): ClosureRow[] => {
  if (!Array.isArray(raw)) return [];
  return [...(raw as ClosureRow[])].sort(
    (a, b) => +closureInstant(a.startAt) - +closureInstant(b.startAt),
  );
};

/** Risposta `auto`/`create`: stesso criterio di `weekdays` per `opening.create`. */
function unwrapClosureRows(created: unknown): ClosureRow[] {
  if (!created || typeof created !== "object") return [];
  const o = created as Record<string, unknown>;
  if (Array.isArray(created)) return created as ClosureRow[];
  const rows = o["rows"];
  if (Array.isArray(rows)) return rows as ClosureRow[];
  const row = o["row"];
  if (row && typeof row === "object") return [row as ClosureRow];
  if ("id" in o && ("startAt" in o || "endAt" in o)) return [created as ClosureRow];
  return [];
}

export default function Closures() {
  const closures = state(server.user.closures.get());

  const form = Form({
    mode: "dark",
    shape: {
      startDate: v.date(),
      startTime: v.time(),
      endDate: v.date(),
      endTime: v.time(),
      note: v.string().optional(),
    },
  });

  const startDateStr = (): string => resolveFieldBinding(form.startDate).get();
  const endDateStr = (): string => resolveFieldBinding(form.endDate).get();
  const startTimeStr = (): string => resolveFieldBinding(form.startTime).get().trim();
  const endTimeStr = (): string => resolveFieldBinding(form.endTime).get().trim();
  /** Elenco ordinato come in UI (`closures()` dalla GET non garantisce ordine). */
  const sortedClosures = (): ClosureRow[] => sortClosureRows(closures());

  /** Fine prima di inizio: la data di inizio non può superare la data fine già scelta. */
  const startDateMax = (): string | undefined => {
    const ed = endDateStr();
    return isValidIsoDate(ed) ? ed : undefined;
  };

  /** Stesso giorno e ora fine già scelta: l’ora inizio non può superare la fine (speculare di `endTimeMin`). */
  const startTimeMax = (): string | undefined => {
    const sd = startDateStr();
    const ed = endDateStr();
    if (!isValidIsoDate(sd) || sd !== ed) return undefined;
    const et = endTimeStr();
    return et.length >= 5 ? et : undefined;
  };

  const endDateMax = (): string | undefined => {
    const sd = startDateStr();
    if (!isValidIsoDate(sd)) return undefined;
    const list = closures() ?? [];
    let next: string | undefined;
    for (const c of list) {
      const cStart = toIsoLocal(c.startAt instanceof Date ? c.startAt : new Date(c.startAt));
      if (!isValidIsoDate(cStart) || cStart <= sd) continue;
      if (next === undefined || cStart < next) next = cStart;
    }
    if (!next) return undefined;
    const cap = addDaysIsoLocal(next, -1);
    const floor = sd > todayIsoLocal() ? sd : todayIsoLocal();
    if (!cap || cap < floor) return undefined;
    return cap;
  };

  const endDateMin = (): string => {
    const t = todayIsoLocal();
    const sd = startDateStr();
    if (isValidIsoDate(sd)) return sd > t ? sd : t;
    return t;
  };

  const endTimeMin = (): string | undefined => {
    const sd = startDateStr();
    const ed = endDateStr();
    if (!isValidIsoDate(sd) || !isValidIsoDate(ed) || sd !== ed) return undefined;
    const st = startTimeStr();
    return st.length >= 5 ? st : undefined;
  };

  /** `v.date()` + `v.time()` → `Date` in fuso locale (`YYYY-MM-DDTHH:mm:ss` senza Z). */
  const localDateTime = (dateIso: string, timeStr: string): Date => {
    const t = timeStr.trim();
    let timePart = "00:00:00";
    if (/^\d{2}:\d{2}:\d{2}/.test(t)) timePart = t.slice(0, 8);
    else if (/^\d{2}:\d{2}$/.test(t.slice(0, 5))) timePart = `${t.slice(0, 5)}:00`;

    return new Date(`${dateIso}T${timePart}`);
  };

  return (
    <>
      <div s="b-2 col b-error round-round w-40 centerx mb-30 children-center bg-background pt-2">
        {/* HEADER */}
        <div s="row w-100% center children-center relative mb-4">
          <t s="text-6 font-6 text-#fff row center">Chiusure</t>
          <div s="right absolute">
            <Popmenu
              mode="light"
              collapsedS="p-1"
              direction="bottom-left"
              collapsed={() => <icon name="plus" size="6" stroke={3} s="text-background" />}
              extended={() => (
                <>
                  <div s="px-4 col gap-2 py-6 gap-6">
                    <div s="row gap-2 b-2 b-#949494 relative p-4 round-10px ">
                      <t s="text-4 font-6 absolute -ty-5 ml-2 p-1   bg-inputLight">Inizio</t>
                      <Input
                        placeholder="Data"
                        field={form.startDate}
                        min={todayIsoLocal}
                        max={startDateMax}
                      />
                      <Input placeholder="Ora" field={form.startTime} max={startTimeMax} />
                    </div>
                    <div s="row gap-2 b-2 b-#949494 relative p-4 round-10px ">
                      <t s="text-4 font-6 absolute -ty-5 ml-2 p-1   bg-inputLight">Fine</t>
                      <Input
                        placeholder="Data"
                        field={form.endDate}
                        min={endDateMin}
                        max={endDateMax}
                      />
                      <Input placeholder="Ora" field={form.endTime} min={endTimeMin} />
                    </div>
                    <Input placeholder="Motivazione" field={form.note} />
                    <div
                      s={{
                        base: {
                          " bg-#909090 row center px-6 py-2 round-10px text-#fff": true,
                          "bg-primary text-background": form.valid,
                        },
                      }}
                      click={async () => {
                        if (!form.valid) return;
                        const sd = startDateStr();
                        const ed = endDateStr();
                        if (!isValidIsoDate(sd) || !isValidIsoDate(ed)) return;

                        const prevSnap = closures();
                        const prevArr = Array.isArray(prevSnap)
                          ? [...(prevSnap as ClosureRow[])]
                          : [];

                        const startAt = localDateTime(sd, startTimeStr());
                        const endAt = localDateTime(ed, endTimeStr());
                        const noteTrim = resolveFieldBinding(form.note).get().trim();
                        const notePayload = noteTrim.length > 0 ? noteTrim : undefined;
                        const tmpId = `__local:${startAt.valueOf()}-${endAt.valueOf()}`;
                        const optimistic: ClosureRow = {
                          id: tmpId,
                          startAt,
                          endAt,
                          note: notePayload,
                        };

                        closures(sortClosureRows([...prevArr, optimistic]) as any);

                        await server.user.closures
                          .create(
                            {
                              startAt,
                              endAt,
                              ...(notePayload != null ? { note: notePayload } : {}),
                            },
                            {
                              onError: () => closures(prevSnap),
                              onSuccess: (out) => {
                                const inserted = unwrapClosureRows(out);
                                const cur = closures();
                                if (!Array.isArray(cur)) return;
                                if (inserted.length === 0) return;
                                closures(
                                  sortClosureRows([
                                    ...cur.filter((r) => r.id !== tmpId),
                                    ...inserted,
                                  ]) as any,
                                );
                              },
                            },
                          )
                          .catch(() => {});
                      }}
                    >
                      Salva
                    </div>
                  </div>
                </>
              )}
            />
          </div>
        </div>

        <div s="col children-center w-100% round-15px">
          {/* HEADER */}
          <div s="row w-100%">
            <div s="text-5 font-6 text-#fff bg-error w-100% p-4 roundtl-15px">Motivazione</div>
            <div s="text-5 font-6 text-#fff bg-error w-100% p-4">Inizio</div>
            <div s="text-5 font-6 text-#fff bg-error w-100% p-4 roundtr-15px">Fine</div>
          </div>

          <For each={sortedClosures}>
            {(c) => (
              <div s="row w-100%">
                {/* NOTE */}
                <div s="text-5 font-6 text-#fff b-2 b-error w-100% p-4 roundbl-8px">{c.note}</div>
                <div s="row gap-2 b-2 b-error children-center p-4">
                  <Input
                    mode="none"
                    type="date"
                    value={closureSplitInstant(c.startAt).date}
                    s="b-2 b-#1d1d1d p-2 round-8px text-4 font-5 text-#fff"
                  />
                  <Input
                    mode="none"
                    type="time"
                    value={closureSplitInstant(c.startAt).time}
                    s="b-2 b-#1d1d1d p-2 round-8px text-4 font-5 text-#fff"
                  />
                </div>
                {/* FINE */}
                <div s="row gap-2 b-2 b-error children-center p-4 roundbr-8px">
                  <Input
                    mode="none"
                    type="date"
                    value={closureSplitInstant(c.endAt).date}
                    s="b-2 b-#1d1d1d hover:(b-error) focus:(b-error) p-2 round-8px text-4 font-5 text-#fff"
                  />
                  <Input
                    mode="none"
                    type="time"
                    value={closureSplitInstant(c.endAt).time}
                    s="b-2 b-#1d1d1d p-2 round-8px text-4 font-5 text-#fff"
                  />
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </>
  );
}
