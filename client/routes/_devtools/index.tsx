import { persistState } from "client";
import Menu from "./_components/menu";
import DB from "./db";
import State from "./state";

export default function MenuDevtools() {
  return (
    <>
      <Menu />
      <switch value={persistState.devtools.menu}>
        <case when="db">{() => <DB />}</case>
        <case when="state">{() => <State />}</case>
      </switch>
    </>
  );
}
