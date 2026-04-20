import { persistState } from "client";
import DB from "./db";
import State from "./state";

export default function MenuDevtools() {
  return (
    <div s="mt-10vh">
      <switch value={persistState.devtools.menu}>
        <case when="db">{() => <DB />}</case>
        <case when="state">{() => <State />}</case>
      </switch>
    </div>
  );
}
