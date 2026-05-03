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

function TypeMenu({ type }: { type: "space" | "person" }) {
  const close = state(false);
  function closer() {
    close(true);
    setTimeout(() => close(false), 50);
  }
  return (
    <Popmenu
      closePulse={() => close()}
      direction="bottom-left"
      mode="light"
      collapsed={() => <icon name="dotsVertical" size={6} stroke={3} s="text-background" />}
      extended={() => (
        <>
          {/* CREATE CATEGORY */}
          <div s="p-2">
            <div
              s="row gap-1 centery children-centery hover:(bg-#bbbbbb) round-10px p-2"
              click={() => {
                closer();
                const c = categories();
                categories([
                  ...(Array.isArray(c) ? c : []),
                  { id: `__o:${crypto.randomUUID()}`, name: "Nuovo Gruppo", type, capacity: 1 },
                ] as any);
                server.user.resourceCategory.create(
                  { name: "Nuovo Gruppo", type, capacity: 1 },
                  {
                    onError: () => {
                      categories(c);
                    },
                  },
                );
              }}
            >
              <icon name="plus" size={6} stroke={3} s="text-background" />
              <t s="text-5 font-6">Crea Gruppo</t>
            </div>
          </div>
        </>
      )}
    />
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// CATEGORIES
// ───────────────────────────────────────────────────────────────────────────────

const categories = state(() => server.user.resourceCategory.get({ deletedAt: null }));
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
                  <icon name={type === "space" ? "box" : "user"} size={7} stroke={3} s="" />
                  <Input
                    size={7}
                    s="text-5 font-6 hover:(b-#bbbbbb)  b-2 b-transparent duration-0 round-10px p-1 w-100%"
                    mode="none"
                    defaultValue={r.name}
                    blur={(value: string) => {
                      if (!value) return;
                      server.user.resourceCategory.update({ id: r.id, name: value });
                    }}
                  />
                  <div s={() => (hover() || device() == "mob" ? "opacity-100 right" : "opacity-0")}>
                    <CategoryMenu category={r} type={type} />
                  </div>
                </div>
                <Resources category={r} />
              </div>
            );
          }}
        </For>
      </div>
    </>
  );
}

function CategoryMenu({ category, type }: { category: any; type: "space" | "person" }) {
  return (
    <Popmenu
      direction="bottom-left"
      mode="light"
      collapsed={() => <icon name="dotsVertical" size={6} stroke={3} s="text-background" />}
      extended={() => (
        <>
          <div s="p-2">
            {/* CREATE RESOURCE */}
            <div
              s="row gap-1 centery children-centery hover:(bg-#bbbbbb) round-10px p-2"
              click={() => {
                server.user.resource.create({
                  name: "Nuovo " + (type === "space" ? "Spazio" : "Persona"),
                  type,
                  categoryId: category.id,
                });
                resources([
                  ...(Array.isArray(resources()) ? resources() : ([] as any)),
                  {
                    id: `__o:${crypto.randomUUID()}`,
                    name: "Nuovo " + (type === "space" ? "Spazio" : "Persona"),
                    type,
                    categoryId: category.id,
                  },
                ] as any);
              }}
            >
              <icon name="plus" size={6} stroke={3} s="text-background" />
              <t s="text-5 font-6">Crea {type === "space" ? "Spazio" : "Persona"}</t>
            </div>
            {/* DELETE RESOURCE */}
            <div
              s="row gap-1 centery children-centery hover:(bg-#bbbbbb) round-10px p-2"
              click={() => {
                const prev = categories();
                const list = Array.isArray(prev) ? [...prev] : [];
                categories(list.filter((c) => String(c.id) !== String(category.id)) as any);
                void server.user.resourceCategory.update(
                  { id: category.id, deletedAt: new Date().toISOString() },
                  {
                    onError: () => categories(prev as any),
                  },
                );
              }}
            >
              <icon name="trash" size={6} stroke={3} s="text-background" />
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
function Resources({ category }: { category: any }) {
  return (
    <>
      <div s="col-2 gap-4 mt-4">
        <For each={() => resources()?.filter((r) => r.categoryId === category.id)}>
          {(r) => (
            <>
              <div s="col bg-tertiary round-round p-4">
                <div s="row centery children-centery gapx-1">
                  <icon name="box" size={6} stroke={3} s="" />
                  <Input
                    size={6}
                    s="text-5 font-6 hover:(b-#bbbbbb)  b-2 b-transparent duration-0 round-10px p-1 w-100%"
                    mode="none"
                    defaultValue={r.name}
                    blur={(value: string) => {
                      if (!value) return;
                      server.user.resource.update({ id: r.id, name: value });
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
