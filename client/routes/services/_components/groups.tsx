import { state } from "client";
import { Form } from "../../../../core/client/form";
import { For } from "../../../../core/client/runtime/tag";
import { server } from "../../../../core/client/server";
import { v } from "../../../../core/client/validator";
import Input, { type InputSelectOption } from "../../../_components/input";
import Popmenu from "../../../_components/popmenu";
import Block from "../../../_components/block";
import Item from "./item";

const listItemsInput = { categoryId: undefined, includeArchived: undefined };

const categories = state(server.user.itemCategory.get);
const items = state(() => server.user.item.get(listItemsInput));
const resources = state(server.user.resource.get);
export default function Groups() {
  return (
    <>
      {/* CREATE CATEGORY */}
      <CreateCategory />
      <div s="col gap-4 des:(w-80%) mob:(w-96%) mt-20 mb-30">

        {/* CATEGORIES */}
        <For each={categories}>
          {(c) => {
            const closePulse = state(0);
            const categoryId = c.id;
            const rowsForCategory = state(() => {
              const root = items() as
                | {
                    items?: {
                      id: string;
                      name: string;
                      booking?: {
                        mode?: "single" | "multi" | "delivery";
                        peopleStep?: { need: boolean; min?: number | null; max?: number | null };
                      };
                      capacity: number;
                      description?: string | null;
                      resources?: string[] | null;
                      duration?: number | null;
                      price?: number | null;
                      categoryId?: string | null;
                    }[];
                  }
                | undefined;
              const list = root?.items ?? [];
              return list.filter(
                (it) => it != null && String(it.categoryId ?? "") === String(categoryId),
              );
            });

            const resourceOptions: InputSelectOption[] = (resources()?.resources ?? [])
              .map((r) => ({
                value: r.id,
                label: r.name,
                group: r.type === "space" ? "Spazi" : "Persone",
              }))
              .sort((a, b) => {
                const o = a.group!.localeCompare(b.group!, "it");
                return o !== 0 ? o : a.label.localeCompare(b.label, "it");
              });

            return (
              <Block
                title={c.name}
                icon="exangon7"
                actions={
                  <div s="row gap-2">
                    <CreateItem categoryId={c.id} />
                    <Popmenu
                      s="bg-error text-#fff"
                      direction="left"
                      closePulse={() => closePulse()}
                      collapsed={() => (
                        <icon name="trash" size="5" stroke={3} s="p-1 text-#ffffffe4" />
                      )}
                      extended={() => (
                        <div
                          s="px-4 py-3 text-center font-6 cursor-pointer"
                          click={async () => {
                            await server.user.itemCategory.remove({ id: c.id });
                            categories(server.user.itemCategory.get());
                            closePulse(1);
                          }}
                        >
                          Elimina
                        </div>
                      )}
                    />
                  </div>
                }
              >
                {/* ITEMS */}
              <div s='col-2 gap-4 mt-3'>
                <For each={rowsForCategory}>
                  {(i) => {
                    return (
                      <Item
                        id={i.id}
                        name={i.name}
                        capacity={i.capacity}
                        description={i.description ?? ""}
                        resource={i.resources?.[0] ?? ""}
                        duration={i.duration ?? 0}
                        price={i.price ?? 0}
                        booking={{
                          mode:
                            i.booking?.mode === "multi" || i.booking?.mode === "delivery"
                              ? i.booking.mode
                              : "single",
                          peopleStep: {
                            need: i.booking?.peopleStep?.need === true,
                            min:
                              typeof i.booking?.peopleStep?.min === "number"
                                ? i.booking.peopleStep.min
                                : undefined,
                            max:
                              typeof i.booking?.peopleStep?.max === "number"
                                ? i.booking.peopleStep.max
                                : undefined,
                          },
                        }}
                        categoryId={i.categoryId ?? ""}
                        resourceOptions={resourceOptions}
                        onUpdated={() => {
                          items(server.user.item.get(listItemsInput));
                        }}
                      />
                    );
                  }}
                </For>
              </div>
              </Block>
            );
          }}
        </For>
      </div>
    </>
  );
}
// ───────────────────────────────────────────────────────────────────────────────
// CREATE CATEGORY
// ───────────────────────────────────────────────────────────────────────────────
function CreateCategory() {
  const form = Form({
    shape: {
      name: v.string(),
    },
  });
  const closePulse = state(0);
  return (
    <>
      <div s="absolute right p-4">
        <Popmenu
          mode="light"
          direction="bottom-left"
          closePulse={() => closePulse()}
          collapsed={() => (
            <icon name="plus" size={6} stroke={3} s="text-secondary p-0 round-20px" />
          )}
          extended={() => (
            <div s="centerx col p-4 gap-4">
              <Input placeholder="Nome" field={form.name} />
              <div
                s={{
                  base: {
                    "bg-#595959a8 text-3 text-#fafafa90 round-10px px-6 py-2 centerx font-6": true,
                    "text-background bg-primary": form.valid,
                  },
                }}
                click={async () => {
                  if (!form.valid()) return;
                  await server.user.itemCategory.create({
                    name: form.values().name,
                  });
                  form.reset();
                  categories(server.user.itemCategory.get());
                }}
              >
                Crea
              </div>
            </div>
          )}
        />
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// CREATE ITEM
// ───────────────────────────────────────────────────────────────────────────────
function CreateItem(p: { categoryId: string }) {
  const closePulse = state(0);
  const resourceOptions: InputSelectOption[] = (resources()?.resources ?? [])
    .map((r) => ({
      value: r.id,
      label: r.name,
      group: r.type === "space" ? "Spazi" : "Persone",
    }))
    .sort((a, b) => {
      const o = a.group!.localeCompare(b.group!, "it");
      return o !== 0 ? o : a.label.localeCompare(b.label, "it");
    });
  const form = Form({
    mode: "dark",
    shape: {
      name: v.string(),
      resource: v.select(),
      duration: v.number(),
      capacity: v.number().min(1),
      bookingMode: v.select(),
      price: v.number().min(0).optional(),
      description: v.string().optional(),
    },
  });
  return (
    <>
      {/* CREATE ITEM */}
      <Popmenu
        mode="light"
        direction="bottom-left"
        closePulse={() => closePulse()}
        collapsed={() => <icon name="plus" size="5" stroke={3} s="p-1 text-secondary" />}
        extended={() => (
          <>
            <div s="col gap-2 p-4">
              <Input placeholder="Nome" field={form.name} />

              <Input placeholder="Capacità" field={form.capacity} />

              <Input placeholder="Risorsa" field={form.resource} options={resourceOptions} />

              <Input placeholder="Durata (minuti)" field={form.duration} />

              <Input
                placeholder="Modalità prenotazione"
                field={form.bookingMode}
                options={[
                  { value: "single", label: "Single" },
                  { value: "multi", label: "Multi" },
                  { value: "delivery", label: "Delivery" },
                ]}
              />

              <Input placeholder="Prezzo" field={form.price} />

              <Input placeholder="Descrizione" field={form.description} />
              <div
                s={{
                  base: {
                    "bg-#595959a8 centerx row text-3 text-#fafafa90 round-10px px-6 py-2 centerx font-6": true,
                    "text-background bg-primary": form.valid,
                  },
                }}
                click={async () => {
                  if (!form.valid()) return;
                  const vals = form.values();
                  await server.user.item.create({
                    name: vals.name,
                    duration: vals.duration,
                    capacity: vals.capacity,
                    price: vals.price,
                    description: vals.description,
                    categoryId: p.categoryId,
                    resources: [vals.resource],
                    standalone: true,
                    booking: {
                      mode: vals.bookingMode as "single" | "multi" | "delivery",
                      peopleStep: { need: false, min: undefined, max: undefined },
                    },
                  });
                  form.reset();
                  items(server.user.item.get(listItemsInput));
                  closePulse(1);
                  setTimeout(() => closePulse(0), 300);
                }}
              >
                Crea
              </div>
            </div>
          </>
        )}
      />
    </>
  );
}
