import { For, Form, server, state, v } from "client";
import Block from "../../_components/block";
import Popmenu from "../../_components/popmenu";
import Menu from "../_components/menu";
import Input from "../../_components/input";

export default function Resources() {
  const createSpace = Form({
    shape: {
      name: v.string(),
      capacity: v.number().min(1),
    },
  });
  const createPerson = Form({
    shape: {
      name: v.string(),
      capacity: v.number().min(1),
    },
  });
  const resources = state(server.user.resource.get);
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky)">
          <Menu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19)">
          <div s="row des:(w-80% mt-20 gap-6)">
            <Block
              s=""
              title="Spazi"
              icon="boxes"
              actions={
                <Popmenu
                  direction="bottom-left"
                  mode="light"
                  collapsed={() => <icon name="plus" size={6} stroke={3} />}
                  extended={() => (
                    <div s="centerx col p-4 gap-4">
                      <Input placeholder="Nome" field={createSpace.name} />
                      <div s="centerx">
                        <Input placeholder="Capienza" field={createSpace.capacity} />
                      </div>
                      <t
                        s={{
                          base: {
                            "bg-#595959a8 text-3 text-#fafafa90 round-10px px-6 py-2 centerx font-6": true,
                            "text-background bg-primary": createSpace.valid,
                          },
                        }}
                        click={async () => {
                          if (!createSpace.valid()) return;
                          await server.user.resource.create({
                            ...createSpace.values(),
                            type: "space",
                          });
                          createSpace.reset();
                          resources(server.user.resource.get());
                        }}
                      >
                        Crea
                      </t>
                    </div>
                  )}
                />
              }
            >
              <div s="des:(col-2 gap-4 mt-4) mob:(col)">
                <For each={resources.space}>
                  {(r) => (
                    <Block s="bg-tertiary">
                      <div s="row  children-centery gapx-1 ">
                        <icon name="box" size={7} stroke={2} />
                        <div s="hover:(b-secondary b-2 )  duration-0 round-10px des:(py-1)">
                          <Input
                            defaultValue={r.name}
                            mode="none"
                            blur={(value: string) => {
                              if (!value) return;
                              server.user.resource.update({ id: r.id, name: value });
                            }}
                          />
                        </div>
                      </div>
                    </Block>
                  )}
                </For>
              </div>
            </Block>
            <Block
              s=""
              title="Personale"
              icon="users"
              actions={
                <Popmenu
                  direction="bottom-left"
                  mode="light"
                  collapsed={() => <icon name="plus" size={6} stroke={3} />}
                  extended={() => (
                    <div s="centerx col p-4 gap-4">
                      <Input placeholder="Nome" field={createPerson.name} />
                      <div s="centerx">
                        <Input placeholder="Capienza" field={createPerson.capacity} />
                      </div>
                      <t
                        s={{
                          base: {
                            "bg-#595959a8 text-3 text-#fafafa90 round-10px px-6 py-2 centerx font-6": true,
                            "text-background bg-primary": createPerson.valid,
                          },
                        }}
                        click={async () => {
                          if (!createPerson.valid()) return;
                          await server.user.resource.create({
                            ...createPerson.values(),
                            type: "person",
                          });
                          createPerson.reset();
                          resources(server.user.resource.get({}));
                        }}
                      >
                        Crea
                      </t>
                    </div>
                  )}
                />
              }
            >
              <For each={() => resources()?.person ?? []}>
                {(resource) => <div>{resource.name}</div>}
              </For>
            </Block>
          </div>
        </div>
      </div>
    </>
  );
}
