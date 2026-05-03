import { For, server, state } from "client";
import Menu from "../../_components/menu";
import Popmenu from "client/_components/popmenu";

export default function Resources() {
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky h-100)">
          <Menu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19) mob:(mb-30)">
          <div s=" des:(w-80 mt-20 gap-6 col) mob:(col w-100% mt-20 gap-6 px-1) ">
            <ResourceCategory type="space" />
            <ResourceCategory type="person" />
          </div>
        </div>
      </div>
    </>
  );
}
// ───────────────────────────────────────────────────────────────────────────────
// RESOURCE CATEGORY
// ───────────────────────────────────────────────────────────────────────────────
const resourceCategories = state(server.user.resourceCategory.get);
function ResourceCategory({ type }: { type: "space" | "person" }) {
  return (
    <>
      <div s="col center des:(w-100%) gap-2 bg-secondary round-round p-4">
        {/* HEADER */}
        <div s="row gap-2 centery">
          <icon
            name={type === "space" ? "boxes" : "users"}
            size={7}
            stroke={2.5}
            s="text-primary"
          />
          <t s="text-6 font-6">{type === "space" ? "Spazi" : "Personale"}</t>
          <div s="right">
            <ResourceCategoryMenu type={type} />
          </div>
        </div>
        {/* GROUPS */}
        <div s="col-2 gap-4 round-round mt-4">
          <For each={() => resourceCategories()?.filter((r) => r.type === type)}>
            {(r) => (
              <div s="col gap-2 bg-tertiary round-round gap-2 p-4">
                <div s="row gap-2 centery">
                  <icon
                    name={type === "space" ? "box" : "user"}
                    size={6}
                    stroke={3}
                    s=""
                  />
                  <t s="text-5 font-6">{r.name}</t>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </>
  );
}

function ResourceCategoryMenu({ type }: { type: "space" | "person" }) {
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
          <div s="p-2">
            <div
              s="row gap-2 centery hover:(bg-#bbbbbb) round-10px p-2"
              click={() => {
                closer();
                const c = resourceCategories();
                resourceCategories([
                  ...(Array.isArray(c) ? c : []),
                  { id: `__o:${crypto.randomUUID()}`, name: "Nuovo Gruppo", type, capacity: 1 },
                ] as any);
                server.user.resourceCategory.create(
                  { name: "Nuovo Gruppo", type, capacity: 1 },
                  {
                    onError: () => {
                      resourceCategories(c);
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
// RESOURCE
// ───────────────────────────────────────────────────────────────────────────────
const resources = state(server.user.resource.get);
function Resource({ type }: { type: "space" | "person" }) {
  return (
    <>
      <div s="col center des:(w-100%) gap-2 bg-secondary round-round p-4">
        {/* HEADER */}
        <div s="row gap-2 centery">
          <icon name={type === "space" ? "boxes" : "users"} size={7} stroke={3} s="text-primary" />
          <t s="text-6 font-6">{type === "space" ? "Spazi" : "Personale"}</t>
          <div s="right">
            <ResourceCategoryMenu type={type} />
          </div>
        </div>
        {/* GROUPS */}
        <div s="col-2 gap-4 ml-10 bg-tertiary round-round gap-4">
          <For each={() => resources()?.filter((r) => r.type === type)}>
            {(r) => (
              <div s="col gap-2  gap-2">
                <t s="text-5 font-6">{r.name}</t>
              </div>
            )}
          </For>
        </div>
      </div>
    </>
  );
}
