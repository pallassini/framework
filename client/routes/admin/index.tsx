import { server, state, tab } from "client";
import AdminMenu from "./_components/menu";
import Resources from "./resorces";
import Prenotations from "./prenotaions";
import Services from "./services";

export default function BookerDemo() {
  const data = state(server.booker.getAllAdmin());
  return (
    <>
      <AdminMenu />
      <switch value={tab()}>
        <case when="prenotations">{() => <Prenotations />}</case>
        <case when="services">{() => <Services />}</case>
        <case when="resources">{() => <Resources />}</case>
      </switch>	
    </>
  );
}
