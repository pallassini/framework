import { clientConfig } from "../client/config";
import type { DesktopPath, DesktopRouteOut } from "./client/desktop";
import type { ServerPath, ServerRouteOut } from "./client/server";

// STATE
export { watch } from "./client/state";
import { createPersistState, createSessionState, createState } from "./client/state";
export const state = createState(clientConfig.state);
export const sessionState = createSessionState(clientConfig.sessionState);
export const persistState = createPersistState(clientConfig.persistState);

/** Posizione tipo: `state<server<"ping.brooo">>>()`, `sessionState(desktop.ping)`, … (omonimo sicuro col valore `server` / `desktop`). */
export type server<P extends ServerPath> = ServerRouteOut<P>;
export type desktop<P extends DesktopPath> = DesktopRouteOut<P>;

// ROUTER
export * from "./client/router";

// VALIDATOR
export { v } from "./client/validator";

// SERVER
export { server } from "./client/server";
export type { ServerPath, ServerRouteOut, ServerRoutes } from "./client/server";

// DESKTOP (RPC webview ↔ Bun; in `client/index.tsx` chiama `initDesktopRpc()`)
export { desktop, initDesktopRpc } from "./client/desktop";
export type { DesktopPath, DesktopRouteOut, DesktopRoutes } from "./client/desktop";

// JSX — `<For>` per inferenza tipi su `each` / `children` (stesso runtime di `<for>`)
export { For } from "./client/runtime/tag";
