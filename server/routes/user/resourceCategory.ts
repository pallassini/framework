import { s } from "server";

export const create = s({ auth: "user", auto: "resourceCategories.create" });
export const update = s({ auth: "user", auto: "resourceCategories.update" });
export const remove = s({ auth: "user", auto: "resourceCategories.remove" });
export const get = s({ auth: "user", auto: "resourceCategories.get" });
