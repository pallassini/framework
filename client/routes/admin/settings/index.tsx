import { auth, go } from "client";
import AdminMenu from "../_components/menu";

export default function Admin() {
  return (
    <>
    
      <div s="des:(row)">
        <div s="des:(sticky)">
          <AdminMenu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19)">
          <div s="bg-secondary round-round des:(mt-20 px-5 py-3 w-50) mob:(mt-20 px-3 py-2 w-98%) children-centerx col">
            <t
              s="text-5 font-6 bg-#cd0000ca round-10px py-2 px-4 hover:(bg-#d30000 scale-110)"
              click={async () => {
                await auth.logout();
                go("/login");
              }}
            >
              Logout
            </t>
          </div>
        </div>
      </div>
    </>
  );
}
