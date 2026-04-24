import { auth, v, Form, state, For, server } from "client";
import type { FormApi } from "../../../../core/client/form/form";
import AdminMenu from "../_components/menu";
import Popmenu from "../../../_components/popmenu";
import Input from "../../../_components/input";
import Block from "../../../_components/block";

const USER_COLUMNS = [
  { key: "email", label: "Email" },
  { key: "username", label: "Username" },
  { key: "domain", label: "Domain" },
] as const;

const ADMIN_USER_PW_SHAPE = { password: v.password() };
type AdminUserPwForm = FormApi<typeof ADMIN_USER_PW_SHAPE>;

/** Un `Form()` per riga: se ricreato a ogni passata del `<For />` resetta il campo e può far “saltare” tutta la tabella. */
const pwFormByUserId = new Map<string, AdminUserPwForm>();

function userPasswordForm(userId: string): AdminUserPwForm {
  let f = pwFormByUserId.get(userId);
  if (!f) {
    f = Form({
      id: `admin-user-pw-${userId}`,
      showFocusShadow: false,
      mode: "dark",
      size: 3,
      shape: ADMIN_USER_PW_SHAPE,
    });
    pwFormByUserId.set(userId, f);
  }
  return f;
}

const _domainDraftProbe = state("");
type DomainDraft = typeof _domainDraftProbe;
const domainLiveByUserId = new Map<string, DomainDraft>();

function domainLiveFor(userId: string, baseline: string): DomainDraft {
  let s = domainLiveByUserId.get(userId);
  if (!s) {
    s = state(baseline);
    domainLiveByUserId.set(userId, s);
  }
  return s;
}

function domainOpenUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function formatPasswordUpdatedAt(raw: unknown): string {
  if (raw == null || raw === "") return "—";
  const d = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

function UserPasswordPopmenu(props: { userId: string; onSaved: () => void }) {
  const { userId, onSaved } = props;
  const pw = userPasswordForm(userId);
  return (
    <Popmenu
      mode="light"
      direction="bottom-left"
      autofocus
      collapsed={() => (
        <icon
          name="keyRound"
          size={5}
          stroke={2}
          s="p-1 text-background bg-#d6d6d6 round-8px cursor-pointer"
        />
      )}
      extended={() => (
        <div s="col gapy-3 px-4 py-4 w-16">
          <Input placeholder="Nuova password" type="password" field={pw.password} />
          <div
            s={{
              base: {
                "bg-primary text-background round-10px px-4 py-2 centerx cursor-pointer": true,
                "opacity-40 cursor-not-allowed": () => !pw.valid(),
              },
            }}
            click={() => {
              if (!pw.valid()) return;
              void server.admin.userUpdate(
                { id: userId, password: pw.values().password },
                {
                  onSuccess: () => onSaved(),
                  onError: () => onSaved(),
                },
              );
            }}
          >
            Salva
          </div>
        </div>
      )}
    />
  );
}

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
            <div s="round-round b-2 b-tertiary mt-5 w-100%">
                <table s="w-100% tbl-fixed bcollapse-separate bspace-0 text-left">
                <thead>
                  <tr s="bg-primary text-background font-6">
                    <For each={USER_COLUMNS}>
                      {(col, i) => (
                        <th
                          s={`des:(text-4 font-6 py-3 px-4) mob:(text-5 font-6 py-2 px-3) valign-middle overflow-hidden tover-ellipsis ws-nowrap bb-2 bb-tertiary br-2 br-tertiary ${i === 0 ? "roundtl-round" : ""}`}
                          style={{
                            width: i === 0 ? "26%" : i === 1 ? "26%" : "20%",
                          }}
                        >
                          {col.label}
                        </th>
                      )}
                    </For>
                    <th
                      s="des:(text-4 font-6 py-3 px-3) mob:(text-5 font-6 py-2 px-2) valign-middle overflow-hidden tover-ellipsis ws-nowrap bb-2 bb-tertiary br-2 br-tertiary"
                      style={{ width: "18%" }}
                    >
                      Password
                    </th>
                    <th
                      s="des:(text-4 font-6 py-3 px-3) mob:(text-5 font-6 py-2 px-2) valign-middle overflow-hidden bb-2 bb-tertiary br-2 br-tertiary roundtr-round"
                      style={{ width: "3.5rem" }}
                    />
                  </tr>
                </thead>
                <tbody>
                  <For each={users}>
                    {(user, rowIndex) => {
                      const rows = users();
                      const n = Array.isArray(rows) ? rows.length : 0;
                      const isLastRow = n > 0 && rowIndex === n - 1;
                      const pwdUpdatedLabel = formatPasswordUpdatedAt(
                        (user as { passwordUpdatedAt?: unknown }).passwordUpdatedAt,
                      );
                      return (
                        <tr s="des:(text-4) mob:(text-5)">
                          <For each={USER_COLUMNS}>
                            {(col) => {
                              const baseline = String(user[col.key] ?? "").trimEnd();
                              const cellS = `hover:(bg-#2f2f2f) valign-middle overflow-hidden tover-ellipsis ws-nowrap br-2 br-tertiary ${!isLastRow ? "bb-2 bb-tertiary" : ""}`;
                              if (col.key === "domain") {
                                const domainSig = domainLiveFor(user.id, baseline);
                                return (
                                  <td key={`${user.id}-${col.key}-${baseline}`} s={cellS}>
                                    <div s="row nowrap gapx-1 children-center w-100%">
                                      <div style={{ flex: "1 1 0%", minWidth: 0 }}>
                                        <Input
                                          mode="none"
                                          defaultValue={baseline}
                                          input={(v) => domainSig(v)}
                                          s="w-100% block minw-0 overflow-hidden tover-ellipsis ws-nowrap des:(py-2 px-4) mob:(py-2 px-3)"
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
                                      </div>
                                      <show when={() => domainOpenUrl(domainSig()) != null}>
                                        <icon
                                          name="squareArrowOutUpRight"
                                          size={5}
                                          stroke={2}
                                          s="p-1 text-primary cursor-pointer"
                                          click={() => {
                                            const href = domainOpenUrl(domainSig());
                                            if (href)
                                              window.open(href, "_blank", "noopener,noreferrer");
                                          }}
                                        />
                                      </show>
                                    </div>
                                  </td>
                                );
                              }
                              return (
                                <td
                                  key={`${user.id}-${col.key}-${baseline}`}
                                  s={cellS}
                                >
                                  <Input
                                    mode="none"
                                    defaultValue={baseline}
                                    s="w-100% block minw-0 overflow-hidden tover-ellipsis ws-nowrap des:(py-2 px-4) mob:(py-2 px-3)"
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
                            s={`hover:(bg-#2f2f2f) valign-middle overflow-hidden tover-ellipsis ws-nowrap br-2 br-tertiary ${!isLastRow ? "bb-2 bb-tertiary" : ""}`}
                          >
                            <div s="row nowrap gapx-2 children-center justify-between w-100% minw-0 des:(py-2 px-4) mob:(py-2 px-3)">
                              <span
                                s="text-4 text-tertiary overflow-hidden tover-ellipsis ws-nowrap minw-0"
                                style={{ flex: "1 1 0%" }}
                                title={pwdUpdatedLabel}
                              >
                                {pwdUpdatedLabel}
                              </span>
                              <UserPasswordPopmenu
                                userId={user.id}
                                onSaved={() => {
                                  users(server.admin.getUsers());
                                }}
                              />
                            </div>
                          </td>
                          <td
                            s={`hover:(bg-#2f2f2f) valign-middle overflow-hidden br-2 br-tertiary ${!isLastRow ? "bb-2 bb-tertiary" : ""}`}
                          >
                            <div s="row nowrap children-center centerx w-100% des:(py-2 px-4) mob:(py-2 px-3)">
                              <icon
                                name="trash"
                                size={5}
                                stroke={2}
                                s="p-1 text-error cursor-pointer"
                              click={() => {
                                void server.admin.userDelete(
                                  { id: user.id },
                                  {
                                    onSuccess: () => {
                                      pwFormByUserId.delete(user.id);
                                      domainLiveByUserId.delete(user.id);
                                      users(server.admin.getUsers());
                                    },
                                    onError: () => {
                                      users(server.admin.getUsers());
                                    },
                                  },
                                );
                              }}
                            />
                            </div>
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
