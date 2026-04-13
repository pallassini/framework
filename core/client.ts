import { clientConfig } from "../client/config";

// STATE
import { createState } from "./client/state";
export const state = createState(clientConfig.state);
export const sessionState = createState(clientConfig.sessionState);
export const persistState = createState(clientConfig.persistState);

// ROUTER
export * from "./client/router";

// VALIDATOR
export { v } from "./client/validator";

// SERVER
export { server } from "./client/server";

// DESKTOP (RPC webview ↔ Bun; in `client/index.tsx` chiama `initDesktopRpc()`)
export { desktop, initDesktopRpc } from "./client/desktop";

