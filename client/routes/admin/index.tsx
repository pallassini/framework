import { server, state } from "client";
import AdminMenu from "./_components/menu";

export default function BookerDemo() {
  const data = state(server.booker.getAllAdmin());
  return (
    <>
      <AdminMenu />
    </>
  );
}
