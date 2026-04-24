import { auth, v, Form, state, For, server } from "client";
import AdminMenu from "../_components/menu";
import Popmenu from "../../../_components/popmenu";
import Input from "../../../_components/input";
import Block from "../../../_components/block";

const USER_COLUMNS = [
  { key: "email", label: "Email" },
  { key: "username", label: "Username" },
  { key: "domain", label: "Domain" },
] as const;

export default function Admin() {
  const createUser = Form({
    showFocusShadow: false,
    mode: "dark",
    size: 3,
    shape: {
      email: v.email("Email non valida"),
      password: v.password(),
      username: v.string(),
      domain: v.string(),
    },
  });
  const res = state<"error" | "success" | "">("");
  const users = state(server.admin.getUsers);

  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky)">
          <AdminMenu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19)">
          <Block
            s="des:(w-70% mt-30) mob:(w-96% mt-20)"
            title="Users"
            icon="users"
            actions={
              <Popmenu
                mode="light"
                direction="bottom-left"
                collapsed={() => (
                  <icon
                    name="plus"
                    size={7}
                    s="p-2 text-background bg-#d6d6d6 round-10px"
                    stroke={2.5}
                  />
                )}
                extended={() => (
                  <div s="col gapy-3 px-5 py-6 w-16">
                    <Input placeholder="Email" field={createUser.email} click={() => res("")} />
                    <Input
                      placeholder="Password"
                      field={createUser.password}
                      click={() => res("")}
                    />
                    <Input
                      placeholder="Username"
                      field={createUser.username}
                      click={() => res("")}
                    />
                    <Input placeholder="Domain" field={createUser.domain} click={() => res("")} />
                    <div
                      s={{
                        base: {
                          "bg-#5959599d text-3 text-#727272 text-background round-10px px-6 py-2  centerx": true,
                          "cursor-not-allowed bg-primary": createUser.valid,
                          "bg-error text-background": () => res() === "error",
                        },
                      }}
                      click={async () => {
                        if (!createUser.valid()) return;
                        await auth.register(
                          { ...createUser.values(), role: "user" },
                          {
                            onSuccess: () => {
                              res("success");
                            },
                            onError: () => {
                              res("error");
                            },
                          },
                        );
                      }}
                    >
                      {() =>
                        res() === "error"
                          ? "Errore"
                          : createUser.valid()
                            ? "Create"
                            : "Compila i campi"
                      }
                    </div>
                  </div>
                )}
              />
            }
          >
            <div s="round-round b-2 b-tertiary mt-5 w-100% overflow-hidden">
              <table s="w-100% tbl-fixed bcollapse-separate bspace-0 text-left">
                <thead>
                  <tr s="bg-primary text-background font-6">
                    <For each={USER_COLUMNS}>
                      {(col, i) => (
                        <th
                          s={`des:(text-4 font-6 py-3 px-4) mob:(text-5 font-6 py-2 px-3) valign-middle overflow-hidden tover-ellipsis ws-nowrap bb-2 bb-tertiary br-2 br-tertiary ${i === 0 ? "roundtl-round" : ""}`}
                        >
                          {col.label}
                        </th>
                      )}
                    </For>
                    <th
                      s="des:(text-4 font-6 py-3 px-2) mob:(text-5 font-6 py-2 px-2) valign-middle text-center bb-2 bb-tertiary roundtr-round minw-14 w-auto"
                    />
                  </tr>
                </thead>
                <tbody>
                  <For each={users}>
                    {(user, rowIndex) => {
                      const rows = users();
                      const n = Array.isArray(rows) ? rows.length : 0;
                      const isLastRow = n > 0 && rowIndex === n - 1;
                      return (
                        <tr s="des:(text-4) mob:(text-5)">
                          <For each={USER_COLUMNS}>
                            {(col) => {
                              const baseline = String(user[col.key] ?? "").trimEnd();
                              return (
                                <td
                                  key={`${user.id}-${col.key}-${baseline}`}
                                  s={`hover:(bg-#2f2f2f) valign-middle overflow-hidden tover-ellipsis ws-nowrap br-2 br-tertiary ${!isLastRow ? "bb-2 bb-tertiary" : ""}`}
                                >
                                  <Input
                                    mode="none"
                                    defaultValue={baseline}
                                    s="w-100% block minw-0 overflow-hidden tover-ellipsis ws-nowrap des:(py-2 px-4) mob:(py-2 px-3) "
                                    blur={(v) => {
                                      void server.admin.userUpdate(
                                        { id: user.id, [col.key]: v },
                                        {
                                          onError: () => {
                                            users(server.admin.getUsers());
                                          },
                                        },
                                      );
                                    }}
                                  />
                                </td>
                              );
                            }}
                          </For>
                          <td
                            s={`hover:(bg-#2f2f2f) valign-middle text-center minw-14 w-auto ${!isLastRow ? "bb-2 bb-tertiary" : ""}`}
                          >
                            <icon
                              name="trash"
                              size={6}
                              stroke={2}
                              s="p-2 text-primary cursor-pointer"
                              click={() => {
                                void server.admin.userDelete(
                                  { id: user.id },
                                  {
                                    onSuccess: () => {
                                      users(server.admin.getUsers());
                                    },
                                    onError: () => {
                                      users(server.admin.getUsers());
                                    },
                                  },
                                );
                              }}
                            />
                          </td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>
          </Block>
        </div>
      </div>
    </>
  );
}
