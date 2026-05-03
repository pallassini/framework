import { device, For, Form, server, state, v } from "client";
import type { PopmenuFeedback } from "../../../_components/popmenu";
import Block from "../../../_components/block";
import Popmenu from "../../../_components/popmenu";
import Menu from "../../_components/menu";
import Input from "../../../_components/input";
import { TimePicker } from "../../../_components/time-picker";

type ResourceRow = {
  id: string;
  name: string;
  capacity?: number | null;
  type?: "space" | "person" | null;
};

// ───────────────────────────────────────────────────────────────────────────────
// RESORCES
// ───────────────────────────────────────────────────────────────────────────────

function resourceRowsFromSignal(get: () => unknown): ResourceRow[] {
  const v = get();
  return Array.isArray(v) ? (v as ResourceRow[]) : [];
}

export default function Resources() {
  const resources = state(server.user.resource.get);
  const spaceResources = state(() =>
    resourceRowsFromSignal(resources).filter((r) => r.type === "space"),
  );
  const personResources = state(() =>
    resourceRowsFromSignal(resources).filter((r) => r.type === "person"),
  );
  const refresh = () => resources(server.user.resource.get());
  const openings = state(server.user.opening.get);
  const refreshOpenings = () => openings(server.user.opening.get());
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky)">
          <Menu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19) mob:(mb-30)">
          <div s=" des:(w-90% mt-20 gap-6 col) mob:(col w-100% mt-20 gap-6 px-3) ">
            <Block s="text-left" title="Orari" icon="clock">
              <div s="des:(col-7 gap-3 mt-4 w-100% text-left items-stretch) mob:(col-2 gap-2 w-100% mt-3)">
                <For each={WEEKDAYS}>
                  {(d) => (
                    <DayOpeningBlock
                      day={d.day}
                      label={d.label}
                      rows={
                        ((Array.isArray(openings()) ? openings() : []) as OpeningHourRow[]).filter(
                          (o) => o.dayOfWeek === d.day && o.itemId == null,
                        )
                      }
                      refreshOpenings={refreshOpenings}
                    />
                  )}
                </For>
              </div>
            </Block>
            <div s="w-100% gap-6 des:(row) mob:(col)">
              {resorce({
                kind: "space",
                title: "Spazi",
                blockIcon: "boxes",
                nameRowIcon: "box",
                form: createSpace,
                listEach: spaceResources,
                refresh,
              })}
              {resorce({
                kind: "person",
                title: "Personale",
                blockIcon: "users",
                nameRowIcon: "user",
                form: createPerson,
                listEach: personResources,
                refresh,
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// OPENING HOURS
// ───────────────────────────────────────────────────────────────────────────────

const WEEKDAYS = [
  { label: "Lunedì", day: "monday" as const },
  { label: "Martedì", day: "tuesday" as const },
  { label: "Mercoledì", day: "wednesday" as const },
  { label: "Giovedì", day: "thursday" as const },
  { label: "Venerdì", day: "friday" as const },
  { label: "Sabato", day: "saturday" as const },
  { label: "Domenica", day: "sunday" as const },
] as const;

type Weekday = (typeof WEEKDAYS)[number]["day"];

type OpeningHourRow = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  itemId?: string | undefined;
};

const DEFAULT_OPEN_START = "09:00:00";
const DEFAULT_OPEN_END = "18:00:00";

function DayOpeningBlock(p: {
  day: Weekday;
  label: string;
  rows: OpeningHourRow[];
  refreshOpenings: () => void;
}) {
  const err = state<string | null>(null);
  const addDefault = async () => {
    err(null);
    try {
      await server.user.opening.create([
        { dayOfWeek: p.day, startTime: DEFAULT_OPEN_START, endTime: DEFAULT_OPEN_END },
      ]);
      p.refreshOpenings();
    } catch (e) {
      err(rpcErrorMessage(e));
    }
  };
  const sorted = [...p.rows].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return (
    <Block
      s="bg-tertiary min-w-0 w-100% self-stretch text-left"
      title={p.label}

      actions={
        <icon
          name="plus"
          size={5}
          stroke={3}
          s="text-secondary bg-#fff p-1 round-16px"
          click={() => void addDefault()}
        />
      }
    >
      <div s="col gap-2 des:(mt-2) mob:(mt-3) w-100% min-w-0 text-left items-stretch">
        {err() ? <t s="text-error text-3">{err()}</t> : null}
        {sorted.length === 0 ? (
          <t s="text-3 opacity-55 text-left">Nessuna fascia oraria</t>
        ) : (
          <For each={() => sorted}>
            {(row: OpeningHourRow) => (
              <OpeningSlotRow
                row={row}
                refreshOpenings={p.refreshOpenings}
                setErr={(m) => err(m)}
              />
            )}
          </For>
        )}
      </div>
    </Block>
  );
}

// DELETE OPENING HOUR
function OpeningHourDeletePopmenu(p: {
  id: string;
  onDeleted: () => void;
  setErr: (m: string | null) => void;
}) {
  const delFeedback = state<PopmenuFeedback | null>(null);
  const delClosePulse = state(0);
  return (
    <Popmenu
      s="bg-error text-#fff"
      mode="light"
      direction="bottom-left"
      feedback={() => delFeedback()}
      onFeedbackDismiss={() => delFeedback(null)}
      closePulse={() => delClosePulse()}
      collapsed={() => {
        const mob = device() === "mob";
        return (
          <icon
            name="trash"
            size={mob ? 3 : 4}
            stroke={3}
            s="p-0.5 cursor-pointer shrink-0"
          />
        );
      }}
      extended={() => (
        <div
          s="px-4 py-3 text-center font-6 cursor-pointer"
          click={() => {
            void server.user.opening.remove(
              { id: p.id },
              {
                onSuccess: () => {
                  delClosePulse(delClosePulse() + 1);
                  window.setTimeout(() => p.onDeleted(), POPMENU_CLOSE_MS);
                },
                onError: (e) => {
                  p.setErr(rpcErrorMessage(e));
                  delFeedback({
                    kind: "error",
                    message: rpcErrorMessage(e),
                    showDismissButton: true,
                    dismissLabel: "Indietro",
                  });
                },
              },
            );
          }}
        >
          Elimina
        </div>
      )}
    />
  );
}

// OPENING HOUR SLOT
function OpeningSlotRow(p: {
  row: OpeningHourRow;
  refreshOpenings: () => void;
  setErr: (m: string | null) => void;
}) {
  const { row: r } = p;
  const rowHover = state(false);
  const save = async (start: string, end: string) => {
    p.setErr(null);
    if (start >= end) {
      p.setErr("L'orario di inizio deve precedere la fine.");
      return;
    }
    try {
      await server.user.opening.update({ id: r.id, startTime: start, endTime: end });
      p.refreshOpenings();
    } catch (e) {
      p.setErr(rpcErrorMessage(e));
    }
  };
  const compactTimes = device() === "mob";
  return (
    <div
      s="row children-centery gap-1 w-100% min-w-0 text-left items-center mob:(gap-0.5)"
      pointerenter={() => rowHover(true)}
      pointerleave={() => rowHover(false)}
    >
      <TimePicker
        compact={compactTimes}
        value={r.startTime}
        onChange={(x) => void save(String(x), r.endTime)}
      />
      <t s="text-3 opacity-60 shrink-0 mob:(text-2)">–</t>
      <TimePicker
        compact={compactTimes}
        value={r.endTime}
        onChange={(x) => void save(r.startTime, String(x))}
      />
      <div s="flex-1 min-w-2" />
      <div
        s={() => {
          const base = "shrink-0 transition-opacity duration-150 ease-out";
          if (device() === "mob") {
            return `${base} opacity-100`;
          }
          return rowHover()
            ? `${base} opacity-100`
            : `${base} pointer-events-none opacity-0`;
        }}
      >
        <OpeningHourDeletePopmenu id={r.id} onDeleted={p.refreshOpenings} setErr={p.setErr} />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// RESOURCE
// ───────────────────────────────────────────────────────────────────────────────
const resourceShape = {
  name: v.string(),
  capacity: v.number().min(1),
} as const;

const createSpace = Form({ shape: resourceShape });
const createPerson = Form({ shape: resourceShape });

type ResourceListForm = typeof createSpace | typeof createPerson;

const RESOURCE_INPUT_S = "hover:(b-#ffffff30 b-2) focus:(b-#fff b-2) duration-0 round-10px py-1";

const POPMENU_CLOSE_MS = 300;

function resorce(p: {
  kind: "space" | "person";
  title: string;
  blockIcon: "boxes" | "users";
  nameRowIcon: "box" | "user";
  listEach: unknown;
  form: ResourceListForm;
  refresh: () => void;
}) {
  const { form, refresh } = p;
  return (
    <Block
      s=""
      title={p.title}
      icon={p.blockIcon}
      actions={
        <Popmenu
          direction="bottom-left"
          mode="light"
          collapsed={() => <icon name="plus" size={6} stroke={3} />}
          extended={() => (
            <div s="centerx col p-4 gap-4">
              <Input placeholder="Nome" field={form.name} />
              <div s="centerx">
                <Input placeholder="Capienza" field={form.capacity} />
              </div>
              <t
                s={{
                  base: {
                    "bg-#595959a8 text-3 text-#fafafa90 round-10px px-6 py-2 centerx font-6": true,
                    "text-background bg-primary": form.valid,
                  },
                }}
                click={async () => {
                  if (!form.valid()) return;
                  await server.user.resource.create({
                    ...form.values(),
                    type: p.kind,
                  });
                  form.reset();
                  refresh();
                }}
              >
                Crea
              </t>
            </div>
          )}
        />
      }
    >
      <div s="des:(col-2 gap-4 mt-4) mob:(col-2 gap-4 mt-4)">
        <For each={p.listEach}>
          {(r: ResourceRow) => (
            <ResourceItemRow row={r} nameRowIcon={p.nameRowIcon} refresh={refresh} />
          )}
        </For>
      </div>
    </Block>
  );
}

// RESOURCE ITEM ROW
function ResourceItemRow(p: {
  row: ResourceRow;
  nameRowIcon: "box" | "user";
  refresh: () => void;
}) {
  const { row: r, refresh } = p;
  const rowHover = state(false);
  return (
    <div
      s="relative w-100%"
      pointerenter={() => rowHover(true)}
      pointerleave={() => rowHover(false)}
    >
      <div
        s={() => {
          const base = "absolute right-0 top-0 z-30 p-2 transition-opacity duration-150 ease-out";
          if (device() === "mob") {
            return `${base} opacity-100`;
          }
          return rowHover() ? `${base} opacity-100` : `${base} pointer-events-none opacity-0`;
        }}
      >
        <ResourceDeletePopmenu resourceId={r.id} onDeleted={refresh} />
      </div>
      <Block s="bg-tertiary">
        <div s="col gap-2">
          <div s="row children-centery gapx-1">
            <icon name={p.nameRowIcon} size={7} stroke={2} />
            <Input
              size={7}
              s={RESOURCE_INPUT_S}
              defaultValue={r.name}
              mode="none"
              blur={(value: string) => {
                if (!value) return;
                server.user.resource.update({ id: r.id, name: value });
              }}
            />
          </div>
          <div s="row children-centery gapx-1">
            <icon name="armchair" size={7} stroke={2} />
            <Input
              size={7}
              s={RESOURCE_INPUT_S}
              defaultValue={r.capacity ?? undefined}
              mode="none"
              type="number"
              blur={(value: number | undefined) => {
                if (value == null || isNaN(value)) return;
                server.user.resource.update({ id: r.id, capacity: value });
              }}
            />
          </div>
        </div>
      </Block>
    </div>
  );
}

//ERROR
function rpcErrorMessage(e: unknown): string {
  if (e != null && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return "Something went wrong. Please try again.";
}

function ResourceDeletePopmenu(props: { resourceId: string; onDeleted: () => void }) {
  const { resourceId, onDeleted } = props;
  const delFeedback = state<PopmenuFeedback | null>(null);
  const delClosePulse = state(0);
  return (
    <Popmenu
      s="bg-error text-#fff"
      mode="light"
      direction="bottom-left"
      feedback={() => delFeedback()}
      onFeedbackDismiss={() => delFeedback(null)}
      closePulse={() => delClosePulse()}
      collapsed={() => <icon name="trash" size={3} stroke={3} s="p-1 cursor-pointer" />}
      extended={() => (
        <div
          s="px-4 py-3 text-center font-6 cursor-pointer"
          click={() => {
            void server.user.resource.remove(
              { id: resourceId },
              {
                onSuccess: () => {
                  delClosePulse(delClosePulse() + 1);
                  window.setTimeout(() => onDeleted(), POPMENU_CLOSE_MS);
                },
                onError: (e) => {
                  delFeedback({
                    kind: "error",
                    message: rpcErrorMessage(e),
                    showDismissButton: true,
                    dismissLabel: "Back",
                  });
                },
              },
            );
          }}
        >
          Elimina
        </div>
      )}
    />
  );
}
