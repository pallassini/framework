import { initDesktopRpc } from "../desktop/electroview";

initDesktopRpc();

export { App } from "./App";
export { go } from "./go";
export { prefetch } from "./prefetch";
export type { PrefetchContext, PrefetchMode } from "./prefetch";
export { url } from "./url";
