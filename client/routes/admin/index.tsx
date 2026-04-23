import { auth } from "client";
import AdminMenu from "./components/menu";

export default function Admin() {
  return (
    <>
      <div s="row children-top">
        <div s="sticky top-0 z-40">
          <AdminMenu />
        </div>
        <div s="col centerx w-100% pb-20">
          <t>Admin</t>
        </div>
      </div>
    </>
  );
}
