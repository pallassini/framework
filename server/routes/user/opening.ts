import { s } from "server";

export const create = s({ auth: "user", auto: "openingHours.create" });
export const update = s({ auth: "user", auto: "openingHours.update" });
export const remove = s({ auth: "user", auto: "openingHours.remove" });
export const get = s({ auth: "user", auto: "openingHours.get" });
