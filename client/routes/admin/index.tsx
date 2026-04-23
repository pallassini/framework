import { auth } from "client";

export default function Admin() {

  return (
    <>
      <t>Admin</t>
      <t click={() => auth.logout()}>LOGOUT</t>
    </>
  );
}