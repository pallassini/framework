import { clientConfig } from "../client/config";

// STATE
export { local, watch } from "./client/state";
export { not } from "./client/runtime/logic/read-when";
import { createPersistState, createSessionState, createState } from "./client/state";
export const state = createState(clientConfig.state);
export const sessionState = createSessionState(clientConfig.sessionState);
export const persistState = createPersistState(clientConfig.persistState);

// ROUTER
export * from "./client/router";
export { routePhase } from "./client/router/App/signals";

// VALIDATOR
export * from "./client/validator";

// SERVER
export { server } from "./client/server";
import type { ServerPath, ServerRouteOut } from "./client/server";
export type server<P extends ServerPath> = ServerRouteOut<P>;

// AUTH — `auth.me.*` reattivo (popolato da `auth.refresh` → `server.auth.me`)
export { auth, isAuthRateLimitError } from "./client/auth";
export type { AuthPublicUser, AuthRpcResult } from "./client/auth";

// DESKTOP
export { desktop } from "./client/desktop";
export { FW_DB_DATA_CHANGED_EVENT, FW_DB_SCHEMA_RELOAD_EVENT } from "./fw-db-schema-reload-event";
import type { DesktopPath, DesktopRouteOut } from "./client/desktop";
export type desktop<P extends DesktopPath> = DesktopRouteOut<P>;

// STYLE (viewport) — stesso meccanismo di `state` (`createState` + `viewport.device()` …)
export { viewport, device, mob, tab, des, onlyDes, setSmoothScrollInteractionLock } from "./client/style";

// Mobile Safari: niente pinch / double-tap zoom sulla pagina
export { installPreventMobileGestureZoom } from "./client/preventMobileGestureZoom";

// JSX COMPONENTS
export { For, icon } from "./client/runtime/tag";

// FORM
export * from "./client/form";

// Web Push — service worker (`core/client/push/sw-push.js`)
export { initPushServiceWorker, SW_PUSH_SCRIPT_URL } from "./client/push/register";
