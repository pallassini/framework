import { clientConfig } from "../desktop/config";

// STATE
import { createState } from "./client/state";
export const state = createState(clientConfig.state);

// ROUTER
export * from "./client/router";
