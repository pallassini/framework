import { App, auth, go, initPushServiceWorker, url } from "client";
import "../core/client/debug/leakProbe";
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

  if (!auth.ready()) return <Page />;

  if (role === "" && path !== "/login" && path !== "/test") go("/login");
  else if (role === "admin" && !path.startsWith("/admin")) go("/admin");
  else if (role === "user" && path.startsWith("/admin")) go("/");

  return <Page />;
});
