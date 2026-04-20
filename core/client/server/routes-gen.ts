/**
 * Auto-generato (plugin Vite / bun core/server/routes/generate.ts).
 * Non modificare a mano.
 */

import { default as _devtools_db, rowDelete as _devtools_db_rowDelete, rowUpdate as _devtools_db_rowUpdate } from "../../../server/routes/_devtools/db/index";
import { login as auth_login, me as auth_me, register as auth_register } from "../../../server/routes/auth/index";
import { bookingCancel as booker_bookingCancel, bookingCreate as booker_bookingCreate, bookingDelete as booker_bookingDelete, bookingList as booker_bookingList, bookingUpdate as booker_bookingUpdate, closureCreate as booker_closureCreate, closureDelete as booker_closureDelete, closureList as booker_closureList, closureUpdate as booker_closureUpdate, getAllAdmin as booker_getAllAdmin, itemCategoryCreate as booker_itemCategoryCreate, itemCategoryDelete as booker_itemCategoryDelete, itemCategoryList as booker_itemCategoryList, itemCategoryUpdate as booker_itemCategoryUpdate, itemCreate as booker_itemCreate, itemDelete as booker_itemDelete, itemList as booker_itemList, itemUpdate as booker_itemUpdate, openingHourCreate as booker_openingHourCreate, openingHourDelete as booker_openingHourDelete, openingHourList as booker_openingHourList, openingHourUpdate as booker_openingHourUpdate, resourceCreate as booker_resourceCreate, resourceDelete as booker_resourceDelete, resourceList as booker_resourceList, resourceUpdate as booker_resourceUpdate } from "../../../server/routes/booker";
import { default as db, rowDelete as db_rowDelete, rowUpdate as db_rowUpdate } from "../../../server/routes/db";

type InferRoute<D> = D extends { _in: infer I; _out: infer O }
	? { in: I; out: O }
	: never;

export type ServerRoutes = {
	"_devtools.db": InferRoute<typeof _devtools_db>;
	"_devtools.db.rowDelete": InferRoute<typeof _devtools_db_rowDelete>;
	"_devtools.db.rowUpdate": InferRoute<typeof _devtools_db_rowUpdate>;
	"auth.login": InferRoute<typeof auth_login>;
	"auth.me": InferRoute<typeof auth_me>;
	"auth.register": InferRoute<typeof auth_register>;
	"booker.bookingCancel": InferRoute<typeof booker_bookingCancel>;
	"booker.bookingCreate": InferRoute<typeof booker_bookingCreate>;
	"booker.bookingDelete": InferRoute<typeof booker_bookingDelete>;
	"booker.bookingList": InferRoute<typeof booker_bookingList>;
	"booker.bookingUpdate": InferRoute<typeof booker_bookingUpdate>;
	"booker.closureCreate": InferRoute<typeof booker_closureCreate>;
	"booker.closureDelete": InferRoute<typeof booker_closureDelete>;
	"booker.closureList": InferRoute<typeof booker_closureList>;
	"booker.closureUpdate": InferRoute<typeof booker_closureUpdate>;
	"booker.getAllAdmin": InferRoute<typeof booker_getAllAdmin>;
	"booker.itemCategoryCreate": InferRoute<typeof booker_itemCategoryCreate>;
	"booker.itemCategoryDelete": InferRoute<typeof booker_itemCategoryDelete>;
	"booker.itemCategoryList": InferRoute<typeof booker_itemCategoryList>;
	"booker.itemCategoryUpdate": InferRoute<typeof booker_itemCategoryUpdate>;
	"booker.itemCreate": InferRoute<typeof booker_itemCreate>;
	"booker.itemDelete": InferRoute<typeof booker_itemDelete>;
	"booker.itemList": InferRoute<typeof booker_itemList>;
	"booker.itemUpdate": InferRoute<typeof booker_itemUpdate>;
	"booker.openingHourCreate": InferRoute<typeof booker_openingHourCreate>;
	"booker.openingHourDelete": InferRoute<typeof booker_openingHourDelete>;
	"booker.openingHourList": InferRoute<typeof booker_openingHourList>;
	"booker.openingHourUpdate": InferRoute<typeof booker_openingHourUpdate>;
	"booker.resourceCreate": InferRoute<typeof booker_resourceCreate>;
	"booker.resourceDelete": InferRoute<typeof booker_resourceDelete>;
	"booker.resourceList": InferRoute<typeof booker_resourceList>;
	"booker.resourceUpdate": InferRoute<typeof booker_resourceUpdate>;
	db: InferRoute<typeof db>;
	"db.rowDelete": InferRoute<typeof db_rowDelete>;
	"db.rowUpdate": InferRoute<typeof db_rowUpdate>;
};

export type ServerPath = keyof ServerRoutes & string;

/** Output RPC per path puntato (es. `ServerRouteOut<"ping.brooo">`). */
export type ServerRouteOut<P extends ServerPath> = ServerRoutes[P]["out"];
