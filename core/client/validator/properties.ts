import { array } from "./properties/array";
import { nullable } from "./properties/nullable";
import { optional } from "./properties/optional";
import { object } from "./properties/object";
import { boolean } from "./properties/boolean";
import { empty } from "./properties/empty";
import { literal } from "./properties/literal";
import { literals } from "./properties/literals";
import { integer, number } from "./properties/number";
import { string } from "./properties/string";
import { unknown } from "./properties/unknown";
import { uuid } from "./properties/uuid";

export const v = {
	uuid,
	string,
	number,
	integer,
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
} as const;
