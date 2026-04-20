import { array } from "./properties/array";
import { date, datetime } from "./properties/date";
import { nullable } from "./properties/nullable";
import { optional } from "./properties/optional";
import { object } from "./properties/object";
import { boolean } from "./properties/boolean";
import { empty } from "./properties/empty";
import { literal } from "./properties/literal";
import { literals } from "./properties/literals";
import { number } from "./properties/number";
import { string } from "./properties/string";
import { unknown } from "./properties/unknown";
import { uuid } from "./properties/uuid";
import { fk } from "./fk";

export const v = {
	uuid,
	string,
	number,
	date,
	datetime,
	boolean,
	empty,
	unknown,
	literal,
	/** Stringa in un insieme finito; in tipo: `satisfies v.Enum<["a","b"]>`. */
	enum: literals,
	optional,
	nullable,
	array,
	object,
	/** FK verso `tableName.id` (stesso comportamento di `fk()` da `core/db/schema/table`). */
	fk,
} as const;
