import { deletedAtLive, notNull } from "db";
import { device, For, server, state } from "client";
import Menu from "../../_components/menu";
import Popmenu from "client/_components/popmenu";
import Input from "client/_components/input";

export default function Main() {
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky h-100)">
          <Menu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19) mob:(mb-30)">
          <div s=" des:(w-85 mt-20 gap-6 col) mob:(col w-100% mt-20 gap-6 px-1) ">
            <Type type="space" />
            <Type type="person" />
          </div>
        </div>
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// TYPE
// ───────────────────────────────────────────────────────────────────────────────
function Type({ type }: { type: "space" | "person" }) {
  return (
    <>
      <div s="col center w-100% gap-2 b-secondary des:(b-4 p-4) mob:(bt-4 bb-4 py-4) round-round ">
        {/* HEADER */}
        <div s="row gap-2 centery mob:(px-4)">
          <icon
            name={type === "space" ? "boxes" : "users"}
            size={7}
            stroke={2.5}
            s="text-primary"
          />
          <t s="text-6 font-6">{type === "space" ? "Spazi" : "Personale"}</t>
          <div s="right">
            <TypeMenu type={type} />
          </div>
        </div>
        <Categories type={type} />
      </div>
    </>
  );
}

const bin = state(server.user.resourceCategory.get({ deletedAt: notNull }));
function TypeMenu({ type }: { type: "space" | "person" }) {
  const close = state(false);
  function closer() {
    close(true);
    setTimeout(() => close(false), 50);
  }

  const binOpen = state(false);
  return (
    <Popmenu
      closePulse={() => close()}
      direction="bottom-left"
      mode="light"
      onClose={() => binOpen(false)}
      collapsed={() => <icon name="dotsVertical" size={6} stroke={3} s="text-background" />}
      extended={() => (
        <>
          <switch>
            <case when={() => !binOpen()}>
              <div s="p-2">
                {/* CREATE CATEGORY */}
                <div
                  s="row gap-1 centery children-centery hover:(bg-#bbbbbb) round-10px p-2"
                  click={() => {
                    closer();
                    categories.create({ name: "Nuovo Gruppo", type, capacity: 1 });
                  }}
                >
                  <icon name="plus" size={4} stroke={3} s="text-background" />
                  <t s="text-3 font-6">Crea Gruppo</t>
                </div>
                {/* BIN */}
                <div
                  s="row gap-1 centery children-centery hover:(bg-#bbbbbb) round-10px p-2"
                  click={() => binOpen(true)}
                >
                  <icon name="trash" size={4} stroke={3} s="text-background" />
                  <t s="text-3 font-6">
                    Cestino ({bin()?.filter((b) => b.type === type)?.length ?? 0})
                  </t>
                </div>
              </div>
            </case>
            <case when={binOpen}>
              <div s="col p-4">
                <div s="row">
                  <icon name="trash" size={4} stroke={3} s="text-background" />
                  <t s="text-5 font-6">Cestino</t>
                </div>
                <div s="col gap-2 mt-2">
                  <For each={() => bin()?.filter((b) => b.type === type)}>
                    {(b) => (
                      <div s="p-2 round-10px hover:(bg-error) children-centery">
                        <icon name="category" size={4} stroke={3} s="text-background" />
                        <t s="text-3 font-6">{b.name}</t>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </case>
          </switch>
        </>
      )}
    />
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// CATEGORIES
// ───────────────────────────────────────────────────────────────────────────────

const categories = state(server.user.resourceCategory.get({ ...deletedAtLive }));
function Categories({ type }: { type: "space" | "person" }) {
  return (
    <>
      <div s="col gap-4 round-round mt-4 w-100%">
        <For each={() => categories()?.filter((r) => r.type === type)}>
          {(r) => {
            const hover = state(false);
            return (
              <div s="col gap-1 bg-secondary round-round p-4" hover={hover}>
                <div s="row centery children-centery">
                  <icon name="category" size={6} stroke={3} s="" />
                  <Input
                    size={6}
                    s="text-4 font-6 hover:(b-#bbbbbb) focus:(b-#bbbbbb)  b-2 b-transparent duration-0 round-10px p-1 w-100%"
                    mode="none"
                    defaultValue={r.name}
                    blur={(value: string) => {
                      if (!value) return;
                      categories.update({ id: r.id, name: value });
                    }}
                  />
                  <div s={() => (hover() || device() == "mob" ? "opacity-100 right" : "opacity-0")}>
                    <CategoryMenu category={r} type={type} />
                  </div>
                </div>
                <Resources category={r} type={type} />
              </div>
            );
          }}
        </For>
      </div>
    </>
  );
}

function CategoryMenu({ category, type }: { category: any; type: "space" | "person" }) {
  const close = state(false);
  function closer() {
    close(true);
    setTimeout(() => close(false), 100);
  }
  return (
    <Popmenu
      direction="bottom-left"
      mode="light"
      closePulse={() => close()}
      collapsed={() => <icon name="dotsVertical" size={6} stroke={3} s="text-background" />}
      extended={() => (
        <>
          <div s="p-2">
            {/* CREATE RESOURCE */}
            <div
              s="row gap-1 centery children-centery hover:(bg-#bbbbbb) round-10px p-2"
              click={() => {
                closer();
                const name = "Nuovo " + (type === "space" ? "Spazio" : "Persona");
                resources.create({ name, type, categoryId: category.id, capacity: 1 });
              }}
            >
              <icon name="plus" size={4} stroke={3} s="text-background" />
              <t s="text-3 font-6">Crea {type === "space" ? "Spazio" : "Persona"}</t>
            </div>
            {/* DELETE RESOURCE */}
            <div
              s={{
                base: {
                  "row gap-1 centery children-centery text-error p-2 round-10px hover:(bg-error text-background)": true,
                },
              }}
              click={() => {
                closer();
                categories.update({
                  id: category.id,
                  deletedAt: new Date().toISOString(),
                });
              }}
            >
              <icon name="trash" size={4} stroke={3} s="" />
              <t s="text-3 font-6">Elimina Gruppo</t>
            </div>
          </div>
        </>
      )}
    />
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// RESOURCES
// ───────────────────────────────────────────────────────────────────────────────
const resources = state(server.user.resource.get);
function Resources({ category, type }: { category: any; type: "space" | "person" }) {
  return (
    <>
      <div s="mob:(col-2) des:(col-3) gap-4 mt-4">
        <For each={() => resources()?.filter((r) => r.categoryId === category.id)}>
          {(r) => (
            <>
              <div s="col bg-tertiary round-round p-4">
                <div s="row centery children-centery">
                  <icon name={type === "space" ? "box" : "user"} size={7} stroke={2.5} s="" />
                  <Input
                    size={7}
                    s="text-5 font-6 hover:(b-#bbbbbb) focus:(b-#bbbbbb)  b-2 b-transparent duration-0 round-10px p-1 w-100%"
                    mode="none"
                    defaultValue={r.name}
                    blur={(value: string) => {
                      if (!value) return;
                      resources.update({ id: r.id, name: value });
                    }}
                  />
                </div>
                <div
                  s="row centery children-centery"
                  show={{ when: type === "space", instant: true }}
                >
                  <icon name="armchair" size={6} stroke={2.5} s="" />

                  <Input
                    size={6}
                    s="text-4 font-6 hover:(b-#bbbbbb) focus:(b-#bbbbbb)  b-2 b-transparent duration-0 round-10px p-1 w-100%"
                    mode="none"
                    defaultValue={r.capacity}
                    type="number"
                    blur={(value: number | undefined) => {
                      if (value == null || isNaN(value)) return;
                      resources.update({ id: r.id, capacity: value });
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </For>
      </div>
    </>
  );
}
