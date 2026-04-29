import { s } from "server";

export const create = s({ auth: "user", auto: "closures.create" });
export const update = s({ auth: "user", auto: "closures.update" });
export const remove = s({ auth: "user", auto: "closures.remove" });
export const get = s({ auth: "user", auto: "closures.get" });
