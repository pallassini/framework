/**
 * Auto-generato (plugin Vite / bun core/server/routes/generate.ts).
 * Non modificare a mano.
 */

import { rpc as _admin_db_rpc } from "../../../server/routes/_admin/db";
import { default as _devtools_db, rowCreate as _devtools_db_rowCreate, rowDelete as _devtools_db_rowDelete, rowUpdate as _devtools_db_rowUpdate } from "../../../server/routes/_devtools/db/index";
import { getUsers as admin_getUsers, userDelete as admin_userDelete, userUpdate as admin_userUpdate } from "../../../server/routes/admin/index";
import { login as auth_login, me as auth_me, register as auth_register } from "../../../server/routes/auth/index";
import { default as consumer } from "../../../server/routes/consumer/index";
import { default as db, rowDelete as db_rowDelete, rowUpdate as db_rowUpdate } from "../../../server/routes/db";
import { default as notification, subscribe as notification_subscribe } from "../../../server/routes/notification";
import { create as user_booking_create, get as user_booking_get, remove as user_booking_remove, update as user_booking_update } from "../../../server/routes/user/booking";
import { create as user_closures_create, get as user_closures_get, remove as user_closures_remove, update as user_closures_update } from "../../../server/routes/user/closures";
import { update as user_update } from "../../../server/routes/user/index";
import { create as user_item_create, get as user_item_get, remove as user_item_remove, update as user_item_update } from "../../../server/routes/user/item";
import { create as user_itemCategory_create, get as user_itemCategory_get, remove as user_itemCategory_remove, update as user_itemCategory_update } from "../../../server/routes/user/itemCategory";
import { create as user_opening_create, get as user_opening_get, prova as user_opening_prova, remove as user_opening_remove, update as user_opening_update } from "../../../server/routes/user/opening";
import { create as user_resource_create, get as user_resource_get, remove as user_resource_remove, update as user_resource_update } from "../../../server/routes/user/resource";

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type ServerRoutes = {
	"_admin.db.rpc": InferRoute<typeof _admin_db_rpc>;
	"_devtools.db": InferRoute<typeof _devtools_db>;
	"_devtools.db.rowCreate": InferRoute<typeof _devtools_db_rowCreate>;
	"_devtools.db.rowDelete": InferRoute<typeof _devtools_db_rowDelete>;
	"_devtools.db.rowUpdate": InferRoute<typeof _devtools_db_rowUpdate>;
	"admin.getUsers": InferRoute<typeof admin_getUsers>;
	"admin.userDelete": InferRoute<typeof admin_userDelete>;
	"admin.userUpdate": InferRoute<typeof admin_userUpdate>;
	"auth.login": InferRoute<typeof auth_login>;
	"auth.me": InferRoute<typeof auth_me>;
	"auth.register": InferRoute<typeof auth_register>;
	consumer: InferRoute<typeof consumer>;
	db: InferRoute<typeof db>;
	"db.rowDelete": InferRoute<typeof db_rowDelete>;
	"db.rowUpdate": InferRoute<typeof db_rowUpdate>;
	notification: InferRoute<typeof notification>;
	"notification.subscribe": InferRoute<typeof notification_subscribe>;
	"user.booking.create": InferRoute<typeof user_booking_create>;
	"user.booking.get": InferRoute<typeof user_booking_get>;
	"user.booking.remove": InferRoute<typeof user_booking_remove>;
	"user.booking.update": InferRoute<typeof user_booking_update>;
	"user.closures.create": InferRoute<typeof user_closures_create>;
	"user.closures.get": InferRoute<typeof user_closures_get>;
	"user.closures.remove": InferRoute<typeof user_closures_remove>;
	"user.closures.update": InferRoute<typeof user_closures_update>;
	"user.item.create": InferRoute<typeof user_item_create>;
	"user.item.get": InferRoute<typeof user_item_get>;
	"user.item.remove": InferRoute<typeof user_item_remove>;
	"user.item.update": InferRoute<typeof user_item_update>;
	"user.itemCategory.create": InferRoute<typeof user_itemCategory_create>;
	"user.itemCategory.get": InferRoute<typeof user_itemCategory_get>;
	"user.itemCategory.remove": InferRoute<typeof user_itemCategory_remove>;
	"user.itemCategory.update": InferRoute<typeof user_itemCategory_update>;
	"user.opening.create": InferRoute<typeof user_opening_create>;
	"user.opening.get": InferRoute<typeof user_opening_get>;
	"user.opening.prova": InferRoute<typeof user_opening_prova>;
	"user.opening.remove": InferRoute<typeof user_opening_remove>;
	"user.opening.update": InferRoute<typeof user_opening_update>;
	"user.resource.create": InferRoute<typeof user_resource_create>;
	"user.resource.get": InferRoute<typeof user_resource_get>;
	"user.resource.remove": InferRoute<typeof user_resource_remove>;
	"user.resource.update": InferRoute<typeof user_resource_update>;
	"user.update": InferRoute<typeof user_update>;
};

export type ServerPath = keyof ServerRoutes & string;

/** Output RPC per path puntato (es. `ServerRouteOut<"ping.brooo">`). */
export type ServerRouteOut<P extends ServerPath> = ServerRoutes[P]["out"];
