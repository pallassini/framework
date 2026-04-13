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
export * from "./client/validator";

// SERVER
export { server } from "./client/server";
import type { ServerPath, ServerRouteOut } from "./client/server";
export type { ServerPath, ServerRouteOut, ServerRoutes } from "./client/server";
export type server<P extends ServerPath> = ServerRouteOut<P>;

// DESKTOP
export { desktop } from "./client/desktop";
import type { DesktopPath, DesktopRouteOut } from "./client/desktop";
export type desktop<P extends DesktopPath> = DesktopRouteOut<P>;

// JSX COMPONENTS
export { For } from "./client/runtime/tag";

// FORM
export * from "./client/form";

// ORM (namespace ∞ / tabelle / engine memory | zig mirror)
export * from "./client/db/orm";
