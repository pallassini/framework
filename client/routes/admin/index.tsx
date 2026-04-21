import { server, state } from "client";
import AdminMenu, { tab } from "./_components/menu";
import Resources from "./resorces";
import Prenotations from "./prenotaions";
import Services from "./services";
export const data = state(server.booker.getAllAdmin());
export default function BookerDemo() {
  return (
    <>
      <div s="row w-100">
        <div s="left">
          <AdminMenu />
        </div>
        <div s="text-6 bg-#3500f3 h-100 w-1 centerx row" />
     
      </div>
    </>
  );
}
