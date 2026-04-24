/**
 * Auto-generato (plugin Vite / bun core/server/routes/generate.ts).
 * Non modificare a mano.
 */

import { rpc as _admin_db_rpc } from "../../../server/routes/_admin/db";
import { default as _devtools_db, rowCreate as _devtools_db_rowCreate, rowDelete as _devtools_db_rowDelete, rowUpdate as _devtools_db_rowUpdate } from "../../../server/routes/_devtools/db/index";
import { getUsers as admin_getUsers, userDelete as admin_userDelete, userUpdate as admin_userUpdate } from "../../../server/routes/admin/index";
import { login as auth_login, me as auth_me, register as auth_register } from "../../../server/routes/auth/index";
import { default as db, rowDelete as db_rowDelete, rowUpdate as db_rowUpdate } from "../../../server/routes/db";
import { bookingCancel as user_booking_bookingCancel, bookingCreate as user_booking_bookingCreate, bookingDelete as user_booking_bookingDelete, bookingList as user_booking_bookingList, bookingUpdate as user_booking_bookingUpdate } from "../../../server/routes/user/booking";
import { closureCreate as user_closures_closureCreate, closureDelete as user_closures_closureDelete, closureList as user_closures_closureList, closureUpdate as user_closures_closureUpdate } from "../../../server/routes/user/closures";
import { update as user_update } from "../../../server/routes/user/index";
import { itemCategoryCreate as user_item_itemCategoryCreate, itemCategoryDelete as user_item_itemCategoryDelete, itemCategoryList as user_item_itemCategoryList, itemCategoryUpdate as user_item_itemCategoryUpdate, itemCreate as user_item_itemCreate, itemDelete as user_item_itemDelete, itemList as user_item_itemList, itemUpdate as user_item_itemUpdate } from "../../../server/routes/user/item";
import { openingHourCreate as user_opening_openingHourCreate, openingHourDelete as user_opening_openingHourDelete, openingHourList as user_opening_openingHourList, openingHourUpdate as user_opening_openingHourUpdate } from "../../../server/routes/user/opening";
import { resourceCreate as user_resource_resourceCreate, resourceDelete as user_resource_resourceDelete, resourceList as user_resource_resourceList, resourceUpdate as user_resource_resourceUpdate } from "../../../server/routes/user/resource";

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
	db: InferRoute<typeof db>;
	"db.rowDelete": InferRoute<typeof db_rowDelete>;
	"db.rowUpdate": InferRoute<typeof db_rowUpdate>;
	"user.booking.bookingCancel": InferRoute<typeof user_booking_bookingCancel>;
	"user.booking.bookingCreate": InferRoute<typeof user_booking_bookingCreate>;
	"user.booking.bookingDelete": InferRoute<typeof user_booking_bookingDelete>;
	"user.booking.bookingList": InferRoute<typeof user_booking_bookingList>;
	"user.booking.bookingUpdate": InferRoute<typeof user_booking_bookingUpdate>;
	"user.closures.closureCreate": InferRoute<typeof user_closures_closureCreate>;
	"user.closures.closureDelete": InferRoute<typeof user_closures_closureDelete>;
	"user.closures.closureList": InferRoute<typeof user_closures_closureList>;
	"user.closures.closureUpdate": InferRoute<typeof user_closures_closureUpdate>;
	"user.item.itemCategoryCreate": InferRoute<typeof user_item_itemCategoryCreate>;
	"user.item.itemCategoryDelete": InferRoute<typeof user_item_itemCategoryDelete>;
	"user.item.itemCategoryList": InferRoute<typeof user_item_itemCategoryList>;
	"user.item.itemCategoryUpdate": InferRoute<typeof user_item_itemCategoryUpdate>;
	"user.item.itemCreate": InferRoute<typeof user_item_itemCreate>;
	"user.item.itemDelete": InferRoute<typeof user_item_itemDelete>;
	"user.item.itemList": InferRoute<typeof user_item_itemList>;
	"user.item.itemUpdate": InferRoute<typeof user_item_itemUpdate>;
	"user.opening.openingHourCreate": InferRoute<typeof user_opening_openingHourCreate>;
	"user.opening.openingHourDelete": InferRoute<typeof user_opening_openingHourDelete>;
	"user.opening.openingHourList": InferRoute<typeof user_opening_openingHourList>;
	"user.opening.openingHourUpdate": InferRoute<typeof user_opening_openingHourUpdate>;
	"user.resource.resourceCreate": InferRoute<typeof user_resource_resourceCreate>;
	"user.resource.resourceDelete": InferRoute<typeof user_resource_resourceDelete>;
	"user.resource.resourceList": InferRoute<typeof user_resource_resourceList>;
	"user.resource.resourceUpdate": InferRoute<typeof user_resource_resourceUpdate>;
	"user.update": InferRoute<typeof user_update>;
};

export type ServerPath = keyof ServerRoutes & string;

/** Output RPC per path puntato (es. `ServerRouteOut<"ping.brooo">`). */
export type ServerRouteOut<P extends ServerPath> = ServerRoutes[P]["out"];
