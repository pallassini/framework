import { server, state } from "client";
import AdminMenu, { tab } from "./_components/menu";
import Resources from "./resorces";
import Prenotations from "./prenotaions";
import Services from "./services";
export  const data = state(server.booker.getAllAdmin());
export default function BookerDemo() {
  return (
    <>
      <AdminMenu />
      <switch value={tab()}>
        <case when="prenotations">
          <Prenotations />
        </case>
        <case when="services">
          <Services />
        </case>
        <case when="resources">
          <Resources />
        </case>
      </switch>
    </>
  );
}
