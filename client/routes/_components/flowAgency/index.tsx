import { device } from "client";
import FlowAgencyMob from "./mob";
import FlowAgencyDes from "./des";

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
