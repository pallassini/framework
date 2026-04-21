import { server, state } from "client";
import AdminMenu, { tab } from "./_components/menu";
import Resources from "./resorces";
import Prenotations from "./prenotaions";
import Services from "./services";
export const data = state(server.booker.getAllAdmin());
export default function BookerDemo() {
  return (
    <>
      <div s="row children-top">
        {/* Niente `left` qui: con `left` il primo figlio usa margin-right:auto e “mangia” lo spazio → il fratello con `centerx` finisce incollato a destra invece che centrato nello spazio rimasto. */}

        <div s="sticky">
          <AdminMenu />
        </div>

   
      <div s='col centerx w-100'>
         <div s='-pl-25'>
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
      
         </div>
      </div>
      </div>
    </>
  );
}
