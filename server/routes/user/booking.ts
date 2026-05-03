import { s } from "server";

export const create = s({ auth: "user", auto: "bookings.create" });
export const update = s({ auth: "user", auto: "bookings.update" });
export const remove = s({ auth: "user", auto: "bookings.remove" });export const get = s({ auth: "user", auto: "bookings.get" });
