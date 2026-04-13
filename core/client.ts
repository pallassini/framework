import { clientConfig } from "../client/config";

// STATE
export { watch } from "./client/state";
import { createPersistState, createSessionState, createState } from "./client/state";
export const state = createState(clientConfig.state);
export const sessionState = createSessionState(clientConfig.sessionState);
export const persistState = createPersistState(clientConfig.persistState);

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
