import { state } from "client";
import { Form } from "../../../core/client/form";
import { For } from "../../../core/client/runtime/tag";
import { server } from "../../../core/client/server";
import { v } from "../../../core/client/validator";
import Input from "../../_components/input";
import Popmenu from "../../_components/popmenu";
import Menu from "../_components/menu";
import Block from "../../_components/block";

export default function Services() {
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky)">
          <Menu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19)">
          <Groups />
        </div>
      </div>
    </>
  );
}

function Groups() {
  const form = Form({
    shape: {
      name: v.string(),
    },
  });
  const categories = state(server.user.itemCategory.get);
  const services = state(server.user.item.get);
  return (
    <>
      {/* CREATE CATEGORY */}
      <div s="absolute right p-4">
        <Popmenu
          mode="light"
          direction="bottom-left"
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
      <div s="col gap-4 des:(w-80%) mob:(w-96%) mt-20">
        {/* CATEGORIES */}
        <For each={categories}>
          {(c) => {
            const closePulse = state(0);
            return (
              <Block
                title={c.name}
                icon="exangon7"
                actions={
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
                }
              >

              </Block>
            );
          }}
        </For>
      </div>
    </>
  );
}

function Service() {
  return (
    <>
      <t>Servizio</t>
    </>
  );
}
