import { device, For, Form, server, state, v } from "client";
import type { PopmenuFeedback } from "../../_components/popmenu";
import Block from "../../_components/block";
import Popmenu from "../../_components/popmenu";
import Menu from "../_components/menu";
import Input from "../../_components/input";

const resourceShape = {
  name: v.string(),
  capacity: v.number().min(1),
} as const;

const createSpace = Form({ shape: resourceShape });
const createPerson = Form({ shape: resourceShape });

type ResourceListForm = typeof createSpace | typeof createPerson;

const RESOURCE_INPUT_S = "hover:(b-#ffffff30 b-2) focus:(b-#fff b-2) duration-0 round-10px py-1";

const POPMENU_CLOSE_MS = 300;

function rpcErrorMessage(e: unknown): string {
  if (e != null && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return "Something went wrong. Please try again.";
}

type ResourceRow = {
  id: string;
  name: string;
  capacity: number;
};

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
          Conferma eliminazione
        </div>
      )}
    />
  );
}

export default function Resources() {
  const resources = state(server.user.resource.get);
  const refresh = () => resources(server.user.resource.get());
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky)">
          <Menu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19) mob:(mb-30)">
          <div s=" des:(w-80% mt-20 gap-6 col) mob:(col w-98% mt-20 gap-6) ">
            <Block title="Orari" icon="clock"></Block>
            <div s="des:(row) gap-6">
              {resorce({
                kind: "space",
                title: "Spazi",
                blockIcon: "boxes",
                nameRowIcon: "box",
                form: createSpace,
                listEach: resources.space,
                refresh,
              })}
              {resorce({
                kind: "person",
                title: "Personale",
                blockIcon: "users",
                nameRowIcon: "user",
                form: createPerson,
                listEach: resources.person,
                refresh,
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

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
              defaultValue={r.capacity}
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
      <div s="des:(col-2 gap-4 mt-4) mob:(col gap-4 mt-4)">
        <For each={p.listEach}>
          {(r: ResourceRow) => (
            <ResourceItemRow row={r} nameRowIcon={p.nameRowIcon} refresh={refresh} />
          )}
        </For>
      </div>
    </Block>
  );
}
