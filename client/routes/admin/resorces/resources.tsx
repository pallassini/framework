import { For, Form, server, state, v } from "client";
import Card from "../_components/card";
import { data } from "..";
import Popmenu from "../_components/popmenu";
import Input from "../_components/input";

export default function Resource() {
  const space = Form({
    bg: "#474747",
    shape: {
      name: v.string().min(5, "Nome troppo corto"),
      capacity: v.number().min(1, "Min 1"),
      description: v.string().optional(),
    },
  });

  const createSpace = () =>
    space.submit(async ({ name, capacity, description }) => {
      await server.booker.resourceCreate(
        [
          {
            name,
            kind: "space",
            capacity,
            description,
            active: true,
            others: {},
          },
        ],
        {
          onSuccess: (res) => {
            data((d) =>
              d ? { ...d, resources: [...(d.resources ?? []), ...res.resources] } : d,
            );
            space.reset();
          },
        },
      );
    });

  const patchResource = (id: string, patch: { name?: string; capacity?: number }) =>
    server.booker.resourceUpdate(
      { id, ...patch },
      {
        onSuccess: ({ resource }) => {
          data((d) =>
            d
              ? {
                  ...d,
                  resources: (d.resources ?? []).map((r) => (r.id === resource.id ? resource : r)),
                }
              : d,
          );
        },
      },
    );

  return (
    <>
      <div s="w-80% centerx ">
        <Card title="Risorse" icon="layers" s="mt-10 bg-background b-2 b-secondary">
          <div s="row gapx-10 mt-5">
            <Card
              title="Spazi"
              icon="boxes"
              actions={
                <Popmenu
                  direction="bottom"
                  offset={{ x: 0, y: 0 }}
                  hoverIn={false}
                  hoverOut={false}
                  autofocus={true}
                  s="bg-#474747 round-20px shadow-xl"
                  collapsed={() => <icon name="plus" size="6" stroke={3} s="p-2" />}
                  extended={() => (
                    <div s="col gapy-2 px-5 py-6 w-26">
                      <Input size={3} type="string" placeholder="Nome" field={space.name} />
                 
                   <div s='centerx'>
                      <Input size={3} type="number" placeholder="Capienza" field={space.capacity}  />
                 
                   </div>
                      <Input size={3} type="string" placeholder="Descrizione" field={space.description} />
                      <div
                        s={{
                          base: {
                            "row children-center centerx mt-2 py-2 px-4 round-12px text-3 font-6 duration-150 select-none": true,
                            "bg-primary color-background cursor-pointer hover:(opacity-90)": space.valid,
                            "bg-#3a3a3a color-#888 cursor-not-allowed": () => !space.valid(),
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
            <Card title="Persone" icon="users">
              <div s="col-2 gapx-4 gapy-4 mt-4">
                <For each={() => (data.resources() ?? []).filter((r) => r.kind === "person")}>
                  {(resource) => ResourceCard({ resource, patchResource })}
                </For>
              </div>
            </Card>
          </div>
        </Card>
       <div s='w-30 px-5 py-5'>
        <Input size={5} type="number" placeholder="Capienza" field={space.capacity} bg="background" />
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

  const autosizeName = (value: string) => {
    if (nameEl) nameEl.size = Math.max(6, value.length + 1);
  };

  return (
    <div
      s="col gapy-2 p-4 round-16px bg-#2a2a2a b-1 b-transparent hover:(bg-#303030) duration-150"
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
              "bg-transparent color-white text-3.5 font-6 outline-none b-1 round-6px px-0.5 py-0.5 duration-120 focus:(b-#666) hover:(b-#555)": true,
              "b-transparent": () => !hover(),
              "b-#3a3a3a": () => hover(),
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
        <Input
          size={2}
          type="number"
          min={1}
          hidePlaceholder
          idle={() => !hover()}
          bg="#2a2a2a"
          idleBorder="transparent"
          activeBorder="#3a3a3a"
          hoverBorder="#555"
          focusBorder="#666"
          initialValue={resource.capacity}
          change={(v) => {
            if (v === undefined || v === resource.capacity) return;
            void patchResource(resource.id, { capacity: v });
          }}
          blur={(v) => {
            if (v === undefined || v === resource.capacity) return;
            void patchResource(resource.id, { capacity: v });
          }}
        />
      </div>
    </div>
  );
}
