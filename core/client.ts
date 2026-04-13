import { clientConfig } from "../desktop/config";

// STATE
import { createState } from "./client/state";
export const state = createState(clientConfig.state);

// ROUTER
export * from "./client/router";

// VALIDATOR
export { v, ValidationError, type InputSchema, type InferSchema } from "./client/validator";
