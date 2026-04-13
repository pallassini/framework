/** Da `registry`, non da `./desktop/routes` (index): così `from "desktop"` non tira `load` / electrodun nel bundle. */
export { d } from "./desktop/routes/registry";
export { desktopError as error } from "./desktop/error";
