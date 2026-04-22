import { For, Form, server, state, v } from "client";
import Card from "../_components/card";
import { data } from "..";
import Popmenu from "../_components/popmenu";
import Input from "../_components/input";
import { useAdminDataMutations } from "../dataMutations";

const space = Form({
  size: 3,
  shape: {
    name: v.string().min(5, "Nome troppo corto"),
    capacity: v.number().min(1, "Min 1"),
    description: v.string().optional(),
  },
});

const person = Form({
  size: 3,
  shape: {
    name: v.string().min(2, "Nome troppo corto"),
    capacity: v.number().min(1, "Min 1"),
    description: v.string().optional(),
  },
});

export default function Resource() {
  const SPACE_DEFAULTS = {
    kind: "space" as const,
    active: true,
    others: {},
  };
  const PERSON_DEFAULTS = {
    kind: "person" as const,
    active: true,
    others: {},
  };
  const { dataCreate, dataUpdate } = useAdminDataMutations(data);

  const createSpace = async () => {
    const payload = { ...space.values(), ...SPACE_DEFAULTS };
    await dataCreate(
      "resources",
      payload,
      () => server.booker.resourceCreate([payload]),
    );
    space.reset();
  };
  const createPerson = async () => {
    const payload = { ...person.values(), ...PERSON_DEFAULTS };
    await dataCreate(
      "resources",
      payload,
      () => server.booker.resourceCreate([payload]),
    );
    person.reset();
  };

  const patchResource = (id: string, patch: { name?: string; capacity?: number }) =>
    dataUpdate(
      "resources",
      id,
      patch,
      () => server.booker.resourceUpdate({ id, ...patch }),
    );

  return (
    <>
      <div s="w-90% centerx">
        <div s="row gapx-10 mt-10">
          <Card
            title="Spazi"
            icon="boxes"
            actions={
              <Popmenu
                direction="bottom"
                autofocus={true}
                mode="light"
                shadow={{
                  color: "#030303",
                  opacity: 0.95,
                  intensity: 2.4,
                  blur: 34,
                  spread: -6,
                  y: 18,
                }}
                collapsedRound="10px"
                collapsed={() => <icon name="plus" size="6" stroke={3} s="p-2 text-secondary" />}
                extended={() => (
                  <div s="col gapy-3 px-5 py-6 w-16">
                    <Input placeholder="Nome" field={space.name} />

                    <div s="centerx">
                      <Input placeholder="Capienza" field={space.capacity} />
                    </div>
                    <Input placeholder="Descrizione" field={space.description} />
                    <div
                      s={{
                        base: {
                          "row centerx mt-2 py-2 px-4 round-12px text-3 font-6 select-none bg-inputOptional color-#888 cursor-not-allowed": true,
                          "bg-background text-primary cursor-pointer hover:(opacity-90) scale-110 px-6":
                            space.valid,
                        },
                      }}
                      click={() => {
                        if (!space.valid()) return;
                        createSpace();
                      }}
                    >
                      Crea
                    </div>
                  </div>
                )}
              />
            }
          >
            <div s="col-2 gapx-4 gapy-4 mt-4">
              <For each={() => (data.resources() ?? []).filter((r) => r.kind === "space")}>
                {(resource) => ResourceCard({ resource, patchResource })}
              </For>
            </div>
          </Card>
          <Card
            title="Persone"
            icon="users"
            actions={
              <Popmenu
                direction="bottom-left"
                autofocus={true}
                mode="light"
                shadow={{
                  color: "#030303",
                  opacity: 0.95,
                  intensity: 2.4,
                  blur: 34,
                  spread: -6,
                  y: 18,
                }}
                collapsedRound="10px"
                collapsed={() => <icon name="plus" size="6" stroke={3} s="p-2 text-secondary" />}
                extended={() => (
                  <div s="col gapy-3 px-5 py-6 w-16">
                    <Input placeholder="Nome" field={person.name} />

                    <div s="centerx">
                      <Input placeholder="Capienza" field={person.capacity} />
                    </div>
                    <Input placeholder="Descrizione" field={person.description} />
                    <div
                      s={{
                        base: {
                          "row centerx mt-2 py-2 px-4 round-12px text-3 font-6 select-none bg-inputOptional color-#888 cursor-not-allowed": true,
                          "bg-background text-primary cursor-pointer hover:(opacity-90) scale-110 px-6":
                            person.valid,
                        },
                      }}
                      click={() => {
                        if (!person.valid()) return;
                        createPerson();
                      }}
                    >
                      Crea
                    </div>
                  </div>
                )}
              />
            }
          >
            <div s="col-2 gapx-4 gapy-4 mt-4">
              <For each={() => (data.resources() ?? []).filter((r) => r.kind === "person")}>
                {(resource) => ResourceCard({ resource, patchResource })}
              </For>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

type Resource = { id: string; name: string; capacity: number; kind: "space" | "person" };

function ResourceCard({
  resource,
  patchResource,
}: {
  resource: Resource;
  patchResource: (id: string, patch: { name?: string; capacity?: number }) => unknown;
}) {
  const hover = state(false);
  let nameEl: HTMLInputElement | undefined;
  let capEl: HTMLInputElement | undefined;

  const autosizeName = (value: string) => {
    if (nameEl) nameEl.size = Math.max(6, value.length + 1);
  };

  const commitCapacity = () => {
    if (!capEl) return;
    const n = parseInt(capEl.value, 10);
    if (!Number.isFinite(n) || n < 1) {
      capEl.value = String(resource.capacity);
      return;
    }
    if (n === resource.capacity) return;
    void patchResource(resource.id, { capacity: n });
  };

  const inputClass = {
    base: {
      "bg-transparent color-white outline-none b-1 round-6px px-0.5 py-0.5 duration-120 focus:(b-#666) hover:(b-#555)": true,
      "b-transparent": () => !hover(),
      "b-#3a3a3a": () => hover(),
    },
  };

  const capFocused = state(false);
  const capHover = state(false);

  return (
    <div
      s="col gapy-2 p-4 round-16px bg-tertiary b-1 b-transparent hover:(bg-#303030) duration-150"
      hover={hover}
    >
      <div s="row centery gapx-1">
        <icon
          name={resource.kind === "space" ? "box" : "user"}
          size="7"
          stroke={2}
          s="color-primary opacity-85"
        />
        <input
          type="text"
          defaultValue={resource.name}
          size={Math.max(6, resource.name.length + 1)}
          ref={(el: HTMLInputElement) => (nameEl = el)}
          s={{
            base: {
              ...inputClass.base,
              "text-3.5 font-6": true,
            },
          }}
          input={autosizeName}
          keydown={(e: KeyboardEvent) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              (e.target as HTMLInputElement).value = resource.name;
              (e.target as HTMLInputElement).blur();
            }
          }}
          blur={(value: string) => {
            const next = value.trim();
            if (!next || next === resource.name) return;
            void patchResource(resource.id, { name: next });
          }}
        />
      </div>
      <div s="row centery gapx-1">
        <icon name="armchair" size="6" stroke={2} s="color-#888" />
        <div
          hover={capHover}
          mousedown={(ev: MouseEvent) => {
            if ((ev.target as HTMLElement).tagName !== "INPUT") ev.preventDefault();
          }}
          s={{
            base: {
              "row centery b-1 round-6px duration-120": true,
              "b-transparent": () => !hover() && !capHover() && !capFocused(),
              "b-#3a3a3a": () => hover() && !capHover() && !capFocused(),
              "b-#555": () => capHover() && !capFocused(),
              "b-#666": () => capFocused(),
            },
          }}
        >
          <input
            type="number"
            inputmode="numeric"
            defaultValue={resource.capacity}
            size={2}
            ref={(el: HTMLInputElement) => (capEl = el)}
            s="bg-transparent color-white outline-none b-0 text-3.5 font-6 text-center tabular-nums py-0 w-5 lh-1  px-1 py-1 "
            focus={() => capFocused(true)}
            keydown={(e: KeyboardEvent) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                (e.target as HTMLInputElement).value = String(resource.capacity);
                (e.target as HTMLInputElement).blur();
              }
            }}
            blur={() => {
              capFocused(false);
              commitCapacity();
            }}
          />
        </div>
      </div>
    </div>
  );
}
