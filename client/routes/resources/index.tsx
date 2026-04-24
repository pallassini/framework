import { Form, server, v } from "client";
import Block from "../../_components/block";
import Popmenu from "../../_components/popmenu";
import Menu from "../_components/menu";
import Input from "../../_components/input";

export default function Resources() {
  const createSpace = Form({
    shape: {
      name: v.string(),
      capacity: v.string(),
    },
  });
  const createPerson = Form({
    shape: {
      name: v.string(),
      capacity: v.string(),
    },
  });
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
                    <>
                      <Input placeholder="Nome" field={createSpace.name} />
                      <Input placeholder="Capienza" field={createSpace.capacity} />
                      <div s="centerx">
                        <t
                          s="text-5 font-6 bg-#cd0000ca round-10px py-2 px-4 hover:(bg-#d30000 scale-110)"
                          click={() => {}}
                        >
                          Crea
                        </t>
                      </div>
                    </>
                  )}
                />
              }
            ></Block>
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
                    <div s="col gap-4 px-4 py-4">
                      <Input placeholder="Nome" field={createPerson.name} />
                      <Input placeholder="Capienza" field={createPerson.capacity} />
                      <div s="centerx">
                        <t
                          s="text-5 font-6 bg-#cd0000ca round-10px py-2 px-4 hover:(bg-#d30000 scale-110)"
                          click={() => {}}
                        >
                          Crea
                        </t>
                      </div>
                    </div>
                  )}
                />
              }
            ></Block>
          </div>
        </div>
      </div>
    </>
  );
}
