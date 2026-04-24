import { auth, v, Form, state, For, server } from "client";
import { resolveFieldBinding } from "../../../../core/client/form/form";
import AdminMenu from "../_components/menu";
import Popmenu from "../../../_components/popmenu";
import Input from "../../../_components/input";
import Block from "../../../_components/block";

const USER_COLUMNS = [
  { key: "email", label: "Email" },
  { key: "username", label: "Username" },
  { key: "domain", label: "Domain" },
] as const;

type UserColumnKey = (typeof USER_COLUMNS)[number]["key"];

type EditTarget = { userId: string; key: UserColumnKey; baseline: string };

const TABLE_HEAD_CELL_S = "des:(text-4 font-6 py-3 px-4) mob:(text-5 font-6 py-2 px-3)";
const TABLE_BODY_ROW_S = "des:(text-4 ) mob:(text-5)";
const TABLE_BODY_CELL_S = "des:(py-2 px-4) mob:(py-2 px-3) hover:(bg-#2f2f2f)";

const CELL_INPUT_STYLE: Record<string, string | number> = {
  minWidth: 0,
  width: "100%",
  boxSizing: "border-box",
  margin: 0,
  padding: 0,
  border: "none",
  outline: "none",
  boxShadow: "none",
  background: "transparent",
  font: "inherit",
  color: "inherit",
  lineHeight: "inherit",
  letterSpacing: "inherit",
  borderRadius: 0,
  appearance: "none",
  WebkitAppearance: "none",
  verticalAlign: "inherit",
};

export default function Admin() {
  const cellDraft = Form({
    id: "admin-users-cell",
    shape: { draft: v.string() },
    mode: "light",
    showFocusShadow: false,
    size: 3,
    bg: "var(--secondary)",
    enterNavigate: false,
  });

  const editing = state<EditTarget | null>(null);

  function flushPendingEdit(cur: EditTarget) {
    const ctl = resolveFieldBinding(cellDraft.draft);
    const next = ctl.get().trim();
    const base = cur.baseline.trim();
    if (next === base) return;
    void server.admin.patchUser({ id: cur.userId, field: cur.key, value: next }).finally(() => {
      users(server.admin.getUsers());
    });
  }

  /**
   * `pointerdown` parte prima del `blur` dell’input: passi a un’altra cella in un colpo solo.
   * `click` resta per chi parte da cella chiusa. Il `blur` chiude in `setTimeout(0)` così non corre
   * prima del `click` / dei microtask del framework.
   */
  function activateCell(user: { id: string } & Partial<Record<UserColumnKey, string | undefined>>, key: UserColumnKey) {
    const cur = editing();
    if (cur && (cur.userId !== user.id || cur.key !== key)) flushPendingEdit(cur);
    startEdit(user, key);
  }

  function pickCell(
    ev: Event,
    user: { id: string } & Partial<Record<UserColumnKey, string | undefined>>,
    key: UserColumnKey,
  ) {
    const el = ev.target as HTMLElement | null;
    if (el?.closest?.("input")) return;
    const ed = editing();
    if (ed?.userId === user.id && ed?.key === key) return;
    activateCell(user, key);
  }

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

  function startEdit(user: { id: string } & Partial<Record<UserColumnKey, string | undefined>>, key: UserColumnKey) {
    if (editing()?.userId === user.id && editing()?.key === key) return;
    const baseline = String(user[key] ?? "");
    editing({ userId: user.id, key, baseline });
    resolveFieldBinding(cellDraft.draft).set(baseline);
  }

  async function finishEdit(userId: string) {
    const ctx = editing();
    if (!ctx || ctx.userId !== userId) return;
    const ctl = resolveFieldBinding(cellDraft.draft);
    const next = ctl.get().trim();
    const base = ctx.baseline.trim();
    editing(null);
    if (next === base) return;
    try {
      await server.admin.patchUser({ id: userId, field: ctx.key, value: next });
    } finally {
      users(server.admin.getUsers());
    }
  }

  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky)">
          <AdminMenu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19)">
          {/* CREATE USER */}
          <Block
            s="des:(w-70% mt-30) mob:(w-96% mt-20)"
            title="Users"
            icon="users"
            actions={
              <Popmenu
                mode="light"
                direction="bottom-left"
                offset={{ x: 4, y: 3 }}
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
            {/* USERS */}
            <div s="round-round b-2 b-tertiary mt-5 w-100% overflow-hidden">
              <table
                s="w-100%"
                style={{
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  tableLayout: "fixed",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr s="bg-primary text-background font-6">
                    <For each={USER_COLUMNS}>
                      {(col, i) => (
                        <th
                          s={TABLE_HEAD_CELL_S}
                          style={{
                            verticalAlign: "middle",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            borderBottom: "2px solid var(--tertiary)",
                            ...(i !== USER_COLUMNS.length - 1
                              ? { borderRight: "2px solid var(--tertiary)" }
                              : {}),
                            ...(i === 0 ? { borderTopLeftRadius: "var(--round)" } : {}),
                            ...(i === USER_COLUMNS.length - 1
                              ? { borderTopRightRadius: "var(--round)" }
                              : {}),
                          }}
                        >
                          {col.label}
                        </th>
                      )}
                    </For>
                  </tr>
                </thead>
                <tbody>
                  <For each={users}>
                    {(user, rowIndex) => {
                      void editing(); // outer For must re-run when edit target changes
                      const rows = users();
                      const n = Array.isArray(rows) ? rows.length : 0;
                      const isLastRow = n > 0 && rowIndex === n - 1;
                      return (
                        <tr s={TABLE_BODY_ROW_S}>
                          <For each={USER_COLUMNS}>
                            {(col, i) => {
                              const isEditing =
                                editing()?.userId === user.id && editing()?.key === col.key;
                              return (
                                <td
                                  s={TABLE_BODY_CELL_S}
                                  style={{
                                    verticalAlign: "middle",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    cursor: "pointer",
                                    ...(!isLastRow ? { borderBottom: "2px solid var(--tertiary)" } : {}),
                                    ...(i !== USER_COLUMNS.length - 1
                                      ? { borderRight: "2px solid var(--tertiary)" }
                                      : {}),
                                  }}
                                  pointerdown={(ev: Event) => pickCell(ev, user, col.key)}
                                  click={(ev: Event) => pickCell(ev, user, col.key)}
                                >
                                  {isEditing ? (
                                    <input
                                      bind={cellDraft.draft}
                                      type={col.key === "email" ? "email" : "text"}
                                      s="w-100%"
                                      style={CELL_INPUT_STYLE}
                                      ref={(el: HTMLInputElement | null) => {
                                        if (!el) return;
                                        requestAnimationFrame(() => {
                                          requestAnimationFrame(() => {
                                            if (!el.isConnected) return;
                                            el.focus({ preventScroll: true });
                                          });
                                        });
                                      }}
                                      blur={() => {
                                        const id = user.id;
                                        setTimeout(() => {
                                          void finishEdit(id);
                                        }, 0);
                                      }}
                                      keydown={(ev: KeyboardEvent) => {
                                        if (ev.key === "Escape") {
                                          ev.preventDefault();
                                          const cur = editing();
                                          if (cur) resolveFieldBinding(cellDraft.draft).set(cur.baseline);
                                          editing(null);
                                        } else if (ev.key === "Enter") {
                                          ev.preventDefault();
                                          void finishEdit(user.id);
                                        }
                                      }}
                                    />
                                  ) : (
                                    <t
                                      s="block w-100%"
                                      style={{
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        pointerEvents: "none",
                                      }}
                                    >
                                      {String(user[col.key] ?? "")}
                                    </t>
                                  )}
                                </td>
                              );
                            }}
                          </For>
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
