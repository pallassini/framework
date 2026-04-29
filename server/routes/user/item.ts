import { s } from "server";

export const create = s({ auth: "user", auto: "items.create" });
export const update = s({ auth: "user", auto: "items.update" });
export const remove = s({ auth: "user", auto: "items.remove" });
export const get = s({ auth: "user", auto: "items.get" });
