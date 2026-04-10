import { go } from "../../core/client/router";

export default function NotFound() {
  return (
    <>
      <t click={() => go("/")}>HOME</t>
      <t>404</t>
    </>
  );
}
