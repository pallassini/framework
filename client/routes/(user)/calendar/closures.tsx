import { server, state } from "client";

export default function Closures() {
  const closures = state(server.user.closures.get());
  return (
    <>
      <div s-></div>
    </>
  );
}
