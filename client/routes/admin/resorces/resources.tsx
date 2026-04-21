import { For, state } from "client";
import Card from "../_components/card";
import { data } from "..";
const createSpace = state(false);
export default function Resource() {
  return (
    <>
      <div s="w-80% centerx ">
        <Card title="Risorse" icon="users" s="mt-10 bg-background b-2 b-secondary">
          <div s="row gapx-10 mt-5">
            <Card title="Spazi" icon="users" actions={<Space />}>
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

function Space() {
  return (
    <div s={{ base: { "absolute w-1.65 h-3 bg-#ff0000 ml-40 round-round mt-10": true, "w-20 h-20": createSpace } }} clickout={() => createSpace(false)}>
      <icon
        name="plus"
        size="6"
        s=" p-1 text-secondary"
        stroke={3}
        click={() => createSpace(!createSpace())}
      />
      <div
        s={{
          base: {
            "round-round bg-primary  opacity-0 events-none mt-3 ": true,
            "opacity-100 events-auto": createSpace,
          },
        }}
      />
    </div>
  );
}

function CreateSpace() {
  return (
    <div s={{ base: { "relative w-8 h-8 ": true } }} clickout={() => createSpace(false)}>
      <div s={{ base: { "absolute w-8 h-8": true, "w-20 h-20": createSpace() } }}>
        <icon
          name="plus"
          size="6"
          s="round-circle bg-#fff p-1 text-secondary"
          stroke={3}
          click={() => createSpace(!createSpace())}
        />
        <div
          s={{
            base: {
              "round-round bg-primary duration-150 opacity-0 events-none mt-3 ": true,
              "opacity-100 events-auto": () => createSpace(),
            },
          }}
        />
      </div>
    </div>
  );
}
