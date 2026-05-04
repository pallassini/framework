import { auth, go } from "client";
import Menu from "../../_components/menu";

export default function Settings() {
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky h-100)">
          <Menu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19) mob:(mb-30)">
          <t click={async () => {
            await auth.logout();
            go("/login");
          }}>LOGOUT</t>
        </div>
      </div>
    </>
  );
}
