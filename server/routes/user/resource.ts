import { s } from "server";

export const create = s({ auth: "user", auto: "resources.create" });

export const update = s({ auth: "user", auto: "resources.update" });

export const remove = s({ auth: "user", auto: "resources.remove" });

export const get = s({ auth: "user", auto: "resources.get" });
