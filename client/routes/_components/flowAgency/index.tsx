import { device } from "client";
import FlowAgencyDes from "./des";
import FlowAgencyMob from "./mob";

export default function FlowAgency() {
  return (
    <>
      <switch value={device}>
        <case when={"des"}>
          <FlowAgencyDes />
        </case>
        <case when={(v) => v === "mob" || v === "tab"}>
          <FlowAgencyMob />
        </case>
      </switch>
    </>
  );
}
