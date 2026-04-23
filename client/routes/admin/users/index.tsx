import { auth } from "client";
import AdminMenu from "../_components/menu";

export default function Admin() {
  return (
    <>
      <div s="des:(row)">
        <div s="des:(sticky)">
          <AdminMenu />
        </div>

        <div s="col centerx children-centerx w-100% des:(-ml-19)">
        </div>
      </div>
    </>
  );
}
