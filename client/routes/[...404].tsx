import { go } from "client";

export default function NotFound() {
  return (
    <>
      <t click={() => go("/")}>HOME</t>
      <t>404</t>
    </>
  );
}
