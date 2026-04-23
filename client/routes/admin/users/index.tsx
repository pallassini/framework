import { auth, v, Form, state } from "client";
import AdminMenu from "../_components/menu";
import Popmenu from "../../../_components/popmenu";
import Input from "../../../_components/input";

export default function Admin() {
  const createUser = Form({
    size: 3,
    shape: {
      email: v.email("Email non valida"),
      password: v.string(),
      username: v.string(),
      domain: v.string(),
    },
  });
  const res = state<"error" | "success" | "">("");
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky)">
          <AdminMenu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19)">
          <div s=" absolute right m-5">
            <Popmenu
              mode="light"
              direction="bottom-left"
              collapsed={() => <icon name="plus" size={7} s="p-2 text-background" stroke={2.5} />}
              extended={() => (
                <div s="col gapy-3 px-5 py-6 w-16">
                  <Input placeholder="Email" field={createUser.email} />
                  <Input placeholder="Password" field={createUser.password} />
                  <Input placeholder="Username" field={createUser.username} />
                  <Input placeholder="Domain" field={createUser.domain} />
                  <div
                    s="bg-primary text-background round-round px-4 py-2"
                    click={async () => {
                      await auth.register({ ...createUser.values(), role: "user" },{onSuccess:()=>});
                    }}
                  >
                    Create
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </>
  );
}
