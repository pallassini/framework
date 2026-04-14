import { persistState } from "client"

export default function MenuDevtools() {
  return (
    <>
      <div s="row gapx-2vw center bg-#1865c2 p-2 font-6">
        <div click={()=>persistState.devtools.menu("db")} s={persistState.devtools.menu == "db" ? "bg-#313131" : ""}>DB</div>
        <div click={()=>persistState.devtools.menu("state")} s={persistState.devtools.menu == "state" ? "bg-#252525" : ""}>STATE</div>
      </div>
      <t>{persistState.devtools.menu}</t>
    </>
  );
}
