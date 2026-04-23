import { auth } from "client";

export default function Home() {
  return (
    <>
      <switch
        value={auth.me.role}
        fallback={
          <>
            <t>login</t>
          </>
        }
      >
        <case when="admin">
          <div s="p-4 font-medium text-emerald-400">Vista admin</div>
        </case>
        <case when="user">
          <div s="p-4">Utente standard</div>
        </case>
      </switch>
    </>
  );
}
