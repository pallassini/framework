import { For, state } from "client";
import Card from "../_components/card";
import { data } from "..";

const spaceOpen = state(false);
export default function Resource() {
  return (
    <>
      <div s="w-80% centerx ">
        <Card title="Risorse" icon="users" s="mt-10 bg-background b-2 b-secondary">
          <div s="row gapx-10 mt-5">
            <Card title="Spazi" icon="users" actions={<Space collapsed={<icon name="plus" size="6" s="p-1 text-secondary" stroke={3} />} extended={<div s="w-50% h-0% bg-#002fff" />} />}>
              <div>
                <For each={data.resources}>
                  {(resource) => {
                    return (
                      <>
                        <div>{resource.name}</div>
                      </>
                    );
                  }}
                </For>
              </div>
            </Card>
            <Card title="Persone" icon="users">
              <div>
                <For each={data.resources}>
                  {(resource) => {
                    return (
                      <>
                        <div>{resource.name}</div>
                      </>
                    );
                  }}
                </For>
              </div>
            </Card>
          </div>
        </Card>
      </div>
    </>
  );
}

function Space({ collapsed, extended }: { collapsed?: unknown; extended?: unknown }) {
  return (
    <div
      s="absolute col children-left ml-40 mt-10  px-3 py-2 overflow-hidden round-round bg-#ff0000"
      clickout={() => spaceOpen(false)}
    >
      <div click={() => spaceOpen(!spaceOpen())}>
        {collapsed}
      </div>
      <div
        s={{
          base: {
            "round-round bg-primary overflow-hidden": true,
            "w-0 min-w-0 h-0 p-0 opacity-0 events-none": () => !spaceOpen(),
            "mt-3 w-10 h-10 p-3 opacity-100 events-auto": spaceOpen,
          },
        }}
      >
        {extended}
      </div>
    </div>
  );
}
