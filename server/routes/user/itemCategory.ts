import { s } from "server";

export const create = s({ auth: "user", auto: "itemCategories.create" });
export const update = s({ auth: "user", auto: "itemCategories.update" });
export const remove = s({ auth: "user", auto: "itemCategories.remove" });
export const get = s({ auth: "user", auto: "itemCategories.get" });
