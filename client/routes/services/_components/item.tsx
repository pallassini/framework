import { server } from "../../../../core/client/server";
import Input, { type InputSelectOption } from "../../../_components/input";
import Block from "../../../_components/block";
import Popmenu, { type PopmenuFeedback } from "../../../_components/popmenu";
import { TimePicker } from "../../../_components/time-picker";
import { For, device, state } from "client";

const S = "hover:(b-#ffffff30 b-2) focus:(b-#fff b-2) duration-0 round-10px py-1";

const SERVICE_HOURS_WEEKDAYS = [
  { label: "Lunedì", day: "monday" as const },
  { label: "Martedì", day: "tuesday" as const },
  { label: "Mercoledì", day: "wednesday" as const },
  { label: "Giovedì", day: "thursday" as const },
  { label: "Venerdì", day: "friday" as const },
  { label: "Sabato", day: "saturday" as const },
  { label: "Domenica", day: "sunday" as const },
] as const;

type ServiceWeekday = (typeof SERVICE_HOURS_WEEKDAYS)[number]["day"];

type ItemHourRow = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
};

const DEFAULT_SVC_OPEN_START = "09:00:00";
const DEFAULT_SVC_OPEN_END = "18:00:00";

const POPMENU_CLOSE_MS = 300;

function rpcErrorMessage(e: unknown): string {
  if (e != null && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return "Qualcosa è andato storto. Riprova.";
}

export type ItemProps = {
  id: string;
  name: string;
  capacity: number;
  description: string;
  resource: string;
  duration: number;
  price: number;
  categoryId: string;
  /** Stabile dal parent: **non** creare con `state()` qui dentro. */
  resourceOptions: readonly InputSelectOption[];
  /** Dopo un salvataggio, ricarica la lista in `groups.tsx`. */
  onUpdated?: () => void;
};

export default function Item(p: ItemProps) {
  const { resourceOptions, onUpdated } = p;
  const delClosePulse = state(0);
  const itemHours = state(
    server.user.opening.get({ resourceId: undefined, itemId: p.id }),
  );
  const refreshItemHours = () => {
    void server.user.opening
      .get({ resourceId: undefined, itemId: p.id })
      .then((r) => itemHours(r));
  };
  const afterSave = () => {
    onUpdated?.();
  };

  return (
    <Block s="bg-tertiary minw-0 w-100%">
      <div s="col gap-2 mt-2">
        <div s="row children-centery gapx-1">
          <icon name="exagon" size={8} stroke={3} s="text-primary shrink-0" />
          <Input
            size={7}
            s={S}
            defaultValue={p.name}
            mode="none"
            type="string"
            placeholder="Nome"
            blur={(value: string) => {
              const v = value.trim();
              if (!v || v === p.name) return;
              void server.user.item.update({ id: p.id, name: v }).then(afterSave);
            }}
          />

          <Popmenu
            s="bg-error text-#fff"
            mode="light"
            direction="bottom-left"
            closePulse={() => delClosePulse()}
            collapsed={() => <icon name="trash" size={5} stroke={3} s="p-1 text-#ffffffe4" />}
            extended={() => (
              <div
                s="px-4 py-3 text-center font-6 cursor-pointer"
                click={() => {
                  void server.user.item.remove({ id: p.id }).then(() => {
                    delClosePulse(delClosePulse() + 1);
                    window.setTimeout(afterSave, 260);
                  });
                }}
              >
                Elimina
              </div>
            )}
          />
        </div>
        <div s="row children-centery gapx-1">
          <icon name="armchair" size={7} stroke={2} s="shrink-0" />
          <Input
            size={7}
            s={S}
            defaultValue={p.capacity}
            mode="none"
            type="number"
            min={0}
            placeholder="Capacità"
            blur={(value: number | undefined) => {
              if (value == null || Number.isNaN(value) || value === p.capacity) return;
              void server.user.item.update({ id: p.id, capacity: value }).then(afterSave);
            }}
          />
        </div>
        <div s="row children-centery gapx-1 w-100% minw-0">
          <icon name="boxes" size={7} stroke={2} s="shrink-0" />
          <Input
            size={7}
            s={S}
            type="select"
            options={resourceOptions as InputSelectOption[]}
            defaultValue={p.resource}
            mode="none"
            emptyLabel="Risorsa"
            direction="bottom-right"
            change={(v) => {
              if (v === p.resource) return;
              const next = v ? [v] : [];
              void server.user.item.update({ id: p.id, resources: next }).then(afterSave);
            }}
          />
        </div>
        <div s="row children-centery gapx-1">
          <icon name="clock" size={7} stroke={2} s="shrink-0" />
          <Input
            size={7}
            s={S}
            defaultValue={p.duration}
            mode="none"
            type="number"
            min={0}
            placeholder="Durata (min)"
            blur={(value: number | undefined) => {
              if (value == null || Number.isNaN(value)) {
                if (p.duration === 0) return;
                void server.user.item.update({ id: p.id, duration: undefined }).then(afterSave);
                return;
              }
              if (value === p.duration) return;
              void server.user.item.update({ id: p.id, duration: value }).then(afterSave);
            }}
          />
        </div>
        <div s="row children-centery gapx-1">
          <icon name="receiptEuro" size={7} stroke={2} s="shrink-0" />
          <Input
            size={7}
            s={S}
            defaultValue={p.price}
            mode="none"
            type="number"
            min={0}
            placeholder="Prezzo"
            blur={(value: number | undefined) => {
              if (value == null || Number.isNaN(value)) {
                if (p.price === 0) return;
                void server.user.item.update({ id: p.id, price: undefined }).then(afterSave);
                return;
              }
              if (value === p.price) return;
              void server.user.item.update({ id: p.id, price: value }).then(afterSave);
            }}
          />
        </div>
        <div s="row children-centery gapx-1 w-100% minw-0">
          <icon name="stickyNote" size={7} stroke={2} s="shrink-0" />
          <Input
            size={7}
            s={S}
            defaultValue={p.description}
            mode="none"
            type="string"
            placeholder="Descrizione"
            blur={(value: string) => {
              const v = value.trim();
              if (v === p.description) return;
              void server.user.item
                .update({ id: p.id, description: v || undefined })
                .then(afterSave);
            }}
          />
        </div>
        <div s="row children-centery gapx-1 w-100% minw-0">
          <Popmenu
            mode="light"
            direction="bottom-right"
            collapsed={() => (
              <icon name="calendarClock" size={7} stroke={2} s="text-secondary p-1" />
            )}
            extended={() => (
              <ItemAvailabilityPanel
                itemId={p.id}
                getHours={() => (itemHours()?.openingHours ?? []) as ItemHourRow[]}
                refresh={refreshItemHours}
              />
            )}
          />
        </div>
      </div>
    </Block>
  );
}

function ItemAvailabilityPanel(p: {
  itemId: string;
  getHours: () => ItemHourRow[];
  refresh: () => void;
}) {
  const err = state<string | null>(null);
  return (
    <div s="col gap-3 p-3 w-100% minw-0" style={{ maxHeight: "min(70vh, 22rem)", overflowY: "auto" }}>
      <t s="text-3 font-6 opacity-90">Quando è prenotabile questo servizio</t>
      {err() ? <t s="text-error text-3">{err()}</t> : null}
      <For each={SERVICE_HOURS_WEEKDAYS}>
        {(d) => (
          <ItemServiceDayBlock
            itemId={p.itemId}
            day={d.day}
            label={d.label}
            rows={p
              .getHours()
              .filter((o) => o.dayOfWeek === d.day)
              .sort((a, b) => a.startTime.localeCompare(b.startTime))}
            refresh={p.refresh}
            setErr={(m) => err(m)}
          />
        )}
      </For>
    </div>
  );
}

function ItemServiceDayBlock(p: {
  itemId: string;
  day: ServiceWeekday;
  label: string;
  rows: ItemHourRow[];
  refresh: () => void;
  setErr: (m: string | null) => void;
}) {
  const addDefault = async () => {
    p.setErr(null);
    try {
      await server.user.opening.create([
        {
          itemId: p.itemId,
          dayOfWeek: p.day,
          startTime: DEFAULT_SVC_OPEN_START,
          endTime: DEFAULT_SVC_OPEN_END,
        },
      ]);
      p.refresh();
    } catch (e) {
      p.setErr(rpcErrorMessage(e));
    }
  };
  return (
    <div s="col gap-2 minw-0 w-100% text-left">
      <div s="row children-centery gap-2">
        <t s="text-3 font-6 flex-1 minw-0">{p.label}</t>
        <icon
          name="plus"
          size={5}
          stroke={3}
          s="text-secondary bg-#fff p-1 round-16px shrink-0 cursor-pointer"
          click={() => void addDefault()}
        />
      </div>
      {p.rows.length === 0 ? (
        <t s="text-3 opacity-55 text-left">Nessuna fascia</t>
      ) : (
        <For each={() => p.rows}>
          {(row: ItemHourRow) => (
            <ItemServiceHourSlotRow row={row} refresh={p.refresh} setErr={p.setErr} />
          )}
        </For>
      )}
    </div>
  );
}

function ItemServiceHourSlotRow(p: {
  row: ItemHourRow;
  refresh: () => void;
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
      p.refresh();
    } catch (e) {
      p.setErr(rpcErrorMessage(e));
    }
  };
  const compactTimes = device() === "mob";
  return (
    <div
      s="row children-centery gap-1 w-100% minw-0 text-left items-center"
      pointerenter={() => rowHover(true)}
      pointerleave={() => rowHover(false)}
    >
      <TimePicker compact={compactTimes} value={r.startTime} onChange={(x) => void save(String(x), r.endTime)} />
      <t s="text-3 opacity-60 shrink-0 mob:(text-2)">–</t>
      <TimePicker compact={compactTimes} value={r.endTime} onChange={(x) => void save(r.startTime, String(x))} />
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
        <ItemServiceHourDeletePopmenu id={r.id} onDeleted={p.refresh} setErr={p.setErr} />
      </div>
    </div>
  );
}

function ItemServiceHourDeletePopmenu(pp: {
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
          <icon name="trash" size={mob ? 3 : 4} stroke={3} s="p-0.5 cursor-pointer shrink-0" />
        );
      }}
      extended={() => (
        <div
          s="px-4 py-3 text-center font-6 cursor-pointer"
          click={() => {
            void server.user.opening.remove(
              { id: pp.id },
              {
                onSuccess: () => {
                  delClosePulse(delClosePulse() + 1);
                  window.setTimeout(() => pp.onDeleted(), POPMENU_CLOSE_MS);
                },
                onError: (e) => {
                  pp.setErr(rpcErrorMessage(e));
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
