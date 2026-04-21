import { App, url } from "client";
import "./index.css";
import Menu from "./components/menu";

App((Page) => (
  <>
    <show when={url.segment(0) != "admin"}>
      <Menu />
    </show>
    <Page />
  </>
));
