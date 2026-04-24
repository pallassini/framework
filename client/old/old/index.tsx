import { device, state } from "client";
import { loadAdminData } from "./dataMutations";
import AdminMenu, { tab } from "../../_components/menu";
import Resources from "./resorces";
import Prenotations from "./prenotaions";
import Services from "./services";
export const data = state(loadAdminData());

export default function BookerDemo() {
  const Content = () => (
    <div s="col centerx w-100% pb-20">
      <switch value={tab}>
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
  );

  return (
    <>
      <icon
        name="box"
        show={() => device() === "mob"}
        size="8"
        stroke={3}
        s="p-2 text-secondary right absolute bg-primary round-circle text-background z-100"
        click={()=>window.location.reload()}
      />
      <switch value={device}>
        <case when="mob">
          <Content />
          <AdminMenu />
        </case>
        <case when={(v) => v === "tab" || v === "des"}>
          <div s="row children-top">
            <div s="sticky top-0 z-40">
              <AdminMenu />
            </div>
            <Content />
          </div>
        </case>
      </switch>
    </>
  );
}
