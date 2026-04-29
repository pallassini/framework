import { App, auth, getTargetUserId, go, initPushServiceWorker, setTargetUserId, url } from "client";
import "./index.css";

if (typeof window !== "undefined") {
	void initPushServiceWorker().catch(() => {
		/* browser senza SW o contesto non sicuro */
	});
}

App((Page) => {
  const role = auth.me.role();
  const path = url.pathname();

  if (path.startsWith("/_devtools")) return <Page />;
  if (path.startsWith("/booker")) return <Page />;

  if (!auth.ready()) return <Page />;

  if (role === "" && path !== "/login") go("/login");
  else if (role !== "" && path === "/login") go("/");
  else if (role === "user" && path.startsWith("/admin")) go("/");

  const impersonating = role === "admin" && getTargetUserId() != null;

  return (
    <>
      {impersonating ? (
        <div
          s="fixed top-3 left-3 z-1000 row items-center gapx-2 px-3 py-2 round-10px bg-primary text-background text-4 font-6 cursor-pointer shadow-md"
          click={() => {
            setTargetUserId(null);
            go("/admin/users");
          }}
          title="Esci dalla vista utente"
        >
          <icon name="chevronLeft" size={5} stroke={2.5} s="shrink-0" />
          Admin
        </div>
      ) : null}
      <Page />
    </>
  );
});
