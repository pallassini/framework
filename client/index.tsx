import { App, auth, go, url } from "client";
import "./index.css";

App((Page) => {
  const role = auth.me.role();
  const path = url.pathname();

  if (path.startsWith("/_devtools")) return <Page />;

  if (role === "" && path !== "/login") go("/login");
  else if (role === "admin" && !path.startsWith("/admin")) go("/admin");
  else if (role === "user" && path.startsWith("/admin")) go("/");

  return <Page />;
});
