import { App, initDesktopRpc } from "client";
import "./index.css";

initDesktopRpc();

App((Page) => (
  <>
    <Page />
  </>
));
