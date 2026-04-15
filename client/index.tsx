import { App } from "client";
import "./index.css";
import Menu from "./components/menu";

App((Page) => (
  <>
    <div
      s={{
        base: "opacity-0",
        animate: [
          { to: "", duration: 700, ease: "ease-in-out" },
          { to: "opacity-100", duration: 400, ease: "ease-in-out" },
          { to: "", duration: 0 },
        ],
      }}
    >
      <Menu />
    </div>
    <Page />
  </>
));
