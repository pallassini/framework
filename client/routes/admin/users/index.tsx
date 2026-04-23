import { auth, v, Form } from "client";
import AdminMenu from "../_components/menu";
import Popmenu from "../../../_components/popmenu";
import Input from "../../../_components/input";

export default function Admin() {
  const createUser = Form({
    size: 3,
    shape: {
      name: v.string().min(5, "Nome troppo corto"),
      email: v.string().email("Email non valida"),
      password: v.string().min(8, "Password troppo corta"),
    },
  });
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky)">
          <AdminMenu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19)">
       <div s=' absolute right m-5'>
          <Popmenu
            mode="light"
            direction="bottom-left"
            collapsed={() => <icon name="plus" size={7} s="p-2 text-background" stroke={2.5} />}
            extended={() => <div s="col gapy-3 px-5 py-6 w-16">
                <Input placeholder="Nome" field={createUser.name} />

                <div s="centerx">
                  <Input placeholder="Capienza" field={createUser.email} />
                </div>
                <Input placeholder="Descrizione" field={createUser.password} />
              </div>}
          />
       </div>
        </div>
      </div>
    </>
  );
}
