import { For, state } from "client";
import Card from "../_components/card";
import { data } from "..";

export default function Resource() {
  const createSpace = state(false);
  return (
    <>
      <div s="w-80% centerx ">
        <Card title="Risorse" icon="users" s="mt-10 bg-background b-2 b-secondary">
          <div s="row gapx-10 mt-5">
            <Card
              title="Spazi"
              icon="users"
              actions={
                <icon
                  name="plus"
                  size="6"
                  s="round-circle bg-#fff p-1 text-secondary"
                  stroke={3}
                  click={() => createSpace(true)}
                />
              }
            >
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


function CreateSpace() {
  return (
    <>
      <div s=" round-round bg-secondary absolute">

      </div>
    </>
  );
}