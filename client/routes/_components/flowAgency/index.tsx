import { device } from "client";
import FlowAgencyDes from "./des";
import Hero from "../hero";

export default function FlowAgency() {
  return (
    <>
      <switch value={device}>
        <case when={"des"}>
          <FlowAgencyDes />
        </case>
        <case when={"mob"}>
          <Hero />
        </case>
        <case when={"tab"}>
          <FlowAgencyDes />
        </case>
      </switch>
    </>
  );
}
