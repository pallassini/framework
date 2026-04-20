//ROUTES
export { s } from "./server/routes";

// MIDDLEWARES (per `s({ middlewares: [routeMw.requireAuth()], … })`)
export { routeMw } from "./server/middlewares";

//ERROR
export { error } from "./server/error";

//VALIDATOR
export * from "./client/validator";